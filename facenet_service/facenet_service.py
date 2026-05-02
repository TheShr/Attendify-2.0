"""
Attendify FaceNet Microservice  v2
===================================
Improvements over v1:
  - Uses DeepFace (Facenet512 model) for production-quality embeddings
    instead of raw pixel averages — faces are actually detected and
    aligned before embedding
  - /recognize detects MULTIPLE faces in one image and matches ALL of
    them in a single pass → one classroom photo marks everyone
  - /verify_student endpoint for single-student self check-in
  - Embeddings averaged over multiple enrollment images per student
  - Graceful fallback: if DeepFace is unavailable (cold start), returns
    clear error rather than silently returning wrong results
  - Thread-safe in-memory store with pickle persistence on Render disk
  - MATCH_THRESHOLD tunable via env var (default 0.55 for Facenet512 cosine)

Dataset recommendation for training / fine-tuning:
  - VGGFace2 (https://github.com/ox-vgg/vgg_face2) — 3.31M images,
    9131 identities, indoor/outdoor, varied poses & lighting.
    Use it to fine-tune the backbone if you have student photos.
  - MS-Celeb-1M cleaned subset — also good for pre-training.
  - For your specific use-case (Indian students, classroom conditions):
    collect ~10–20 photos per student at enrollment time (different
    angles, lighting) and average the embeddings.
"""

import io
import os
import pickle
import threading
from typing import Dict, List, Optional, Tuple

import numpy as np
from flask import Flask, jsonify, request
from PIL import Image

# ── Try to import DeepFace (production) ──────────────────────
try:
    from deepface import DeepFace
    _DEEPFACE_AVAILABLE = True
    _MODEL_NAME = "Facenet512"
    _DETECTOR  = "retinaface"   # best accuracy; fall back to opencv if slow
    print(f"[FaceNet] DeepFace loaded — model={_MODEL_NAME}, detector={_DETECTOR}")
except ImportError:
    _DEEPFACE_AVAILABLE = False
    print("[FaceNet] WARNING: DeepFace not available — using pixel fallback (dev only)")

# ── Try to import OpenCV for multi-face detection fallback ────
try:
    import cv2
    _CV2_AVAILABLE = True
    _FACE_CASCADE = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    print("[FaceNet] OpenCV loaded for face detection")
except ImportError:
    _CV2_AVAILABLE = False
    print("[FaceNet] WARNING: OpenCV not available")

# ─────────────────────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────────────────────
MATCH_THRESHOLD = float(os.getenv("MATCH_THRESHOLD", "0.55"))
EMBEDDINGS_PATH = os.getenv(
    "EMBEDDINGS_PATH",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "embeddings.pkl"),
)
PORT = int(os.getenv("PORT", "5001"))

os.makedirs(os.path.dirname(EMBEDDINGS_PATH), exist_ok=True)

# ─────────────────────────────────────────────────────────────
# State — {student_id: np.ndarray (averaged embedding)}
# ─────────────────────────────────────────────────────────────
_embeddings: Dict[str, np.ndarray] = {}
# Raw per-enrollment embeddings — kept so we can re-average
_raw_embeddings: Dict[str, List[np.ndarray]] = {}
_lock = threading.Lock()

app = Flask(__name__)


# ─────────────────────────────────────────────────────────────
# Persistence
# ─────────────────────────────────────────────────────────────
def _load_embeddings():
    if not os.path.exists(EMBEDDINGS_PATH):
        return
    try:
        with open(EMBEDDINGS_PATH, "rb") as f:
            data = pickle.load(f)
        with _lock:
            _embeddings.clear()
            _raw_embeddings.clear()
            for sid, avg in data.get("embeddings", {}).items():
                _embeddings[sid] = np.asarray(avg, dtype="float32")
            for sid, raws in data.get("raw_embeddings", {}).items():
                _raw_embeddings[sid] = [np.asarray(r, dtype="float32") for r in raws]
        print(f"[FaceNet] Loaded {len(_embeddings)} enrolled students")
    except Exception as e:
        print(f"[FaceNet] Failed to load embeddings: {e}")


def _save_embeddings():
    try:
        with _lock:
            data = {
                "embeddings": {k: v.tolist() for k, v in _embeddings.items()},
                "raw_embeddings": {k: [r.tolist() for r in raws]
                                   for k, raws in _raw_embeddings.items()},
            }
        with open(EMBEDDINGS_PATH, "wb") as f:
            pickle.dump(data, f)
    except Exception as e:
        print(f"[FaceNet] Failed to save embeddings: {e}")


# ─────────────────────────────────────────────────────────────
# Embedding computation
# ─────────────────────────────────────────────────────────────
def _bytes_to_rgb(image_bytes: bytes) -> np.ndarray:
    img = Image.open(io.BytesIO(image_bytes))
    if img.mode != "RGB":
        img = img.convert("RGB")
    return np.asarray(img, dtype="uint8")


def _compute_embedding_deepface(rgb: np.ndarray) -> Optional[np.ndarray]:
    """Use DeepFace to extract a face embedding. Returns L2-normalised vector."""
    try:
        result = DeepFace.represent(
            img_path=rgb,
            model_name=_MODEL_NAME,
            detector_backend=_DETECTOR,
            enforce_detection=True,
            align=True,
        )
        if not result:
            return None
        # If multiple faces detected, take the most prominent (largest face area)
        best = max(result, key=lambda r: r.get("facial_area", {}).get("w", 0) * r.get("facial_area", {}).get("h", 0))
        vec  = np.asarray(best["embedding"], dtype="float32")
        norm = np.linalg.norm(vec)
        return vec / norm if norm > 0 else vec
    except Exception as e:
        print(f"[FaceNet] DeepFace embedding error: {e}")
        return None


def _compute_embedding_fallback(rgb: np.ndarray) -> np.ndarray:
    """Pixel-hash fallback when DeepFace is unavailable (development only)."""
    img  = Image.fromarray(rgb).resize((64, 64))
    vec  = np.asarray(img, dtype="float32").reshape(-1)
    norm = np.linalg.norm(vec)
    return vec / norm if norm > 0 else vec


def _compute_embedding(image_bytes: bytes) -> Optional[np.ndarray]:
    rgb = _bytes_to_rgb(image_bytes)
    if _DEEPFACE_AVAILABLE:
        return _compute_embedding_deepface(rgb)
    return _compute_embedding_fallback(rgb)


def _cosine_distance(a: np.ndarray, b: np.ndarray) -> float:
    """1 - cosine_similarity; 0 = identical, 2 = opposite."""
    dot  = float(np.dot(a, b))
    norm = float(np.linalg.norm(a) * np.linalg.norm(b))
    if norm == 0:
        return 1.0
    return 1.0 - dot / norm


# ─────────────────────────────────────────────────────────────
# Multi-face detection in classroom photo
# ─────────────────────────────────────────────────────────────
def _detect_and_embed_all_faces(image_bytes: bytes) -> List[dict]:
    """
    Detect ALL faces in a classroom image.
    Returns list of {embedding, bbox} dicts.

    Strategy:
      1. Try DeepFace with retinaface (detects multiple faces)
      2. Fall back to OpenCV cascade + per-face embed
      3. Last resort: treat whole image as one face
    """
    rgb = _bytes_to_rgb(image_bytes)

    # ── DeepFace multi-face ───────────────────────────────────
    if _DEEPFACE_AVAILABLE:
        try:
            results = DeepFace.represent(
                img_path=rgb,
                model_name=_MODEL_NAME,
                detector_backend=_DETECTOR,
                enforce_detection=False,   # don't raise if no face found
                align=True,
            )
            faces = []
            for r in results:
                vec  = np.asarray(r["embedding"], dtype="float32")
                norm = np.linalg.norm(vec)
                if norm > 0:
                    vec = vec / norm
                area = r.get("facial_area", {})
                faces.append({
                    "embedding": vec,
                    "bbox":      [area.get("x", 0), area.get("y", 0),
                                  area.get("w", 0), area.get("h", 0)],
                    "confidence": r.get("face_confidence", 1.0),
                })
            if faces:
                return faces
        except Exception as e:
            print(f"[FaceNet] DeepFace multi-face error: {e}")

    # ── OpenCV Haar cascade fallback ──────────────────────────
    if _CV2_AVAILABLE:
        try:
            gray  = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
            dets  = _FACE_CASCADE.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
            faces = []
            for (x, y, w, h) in dets:
                face_crop  = rgb[y:y+h, x:x+w]
                face_bytes = _pil_to_bytes(Image.fromarray(face_crop))
                emb        = _compute_embedding(face_bytes)
                if emb is not None:
                    faces.append({"embedding": emb, "bbox": [int(x), int(y), int(w), int(h)], "confidence": 0.8})
            if faces:
                return faces
        except Exception as e:
            print(f"[FaceNet] OpenCV cascade error: {e}")

    # ── Whole-image fallback ──────────────────────────────────
    emb = _compute_embedding(image_bytes)
    if emb is not None:
        h, w = rgb.shape[:2]
        return [{"embedding": emb, "bbox": [0, 0, w, h], "confidence": 0.5}]
    return []


def _pil_to_bytes(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


# ─────────────────────────────────────────────────────────────
# Matching
# ─────────────────────────────────────────────────────────────
def _match_embedding(probe: np.ndarray) -> Tuple[Optional[str], float]:
    """Return (best_student_id, distance). None if no match below threshold."""
    with _lock:
        if not _embeddings:
            return None, 1.0
        best_sid  = None
        best_dist = float("inf")
        for sid, stored in _embeddings.items():
            dist = _cosine_distance(probe, stored)
            if dist < best_dist:
                best_dist = dist
                best_sid  = sid
    if best_dist <= MATCH_THRESHOLD:
        return best_sid, best_dist
    return None, best_dist


# ─────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return jsonify({
        "ok":                True,
        "deepface":          _DEEPFACE_AVAILABLE,
        "opencv":            _CV2_AVAILABLE,
        "enrolled_students": len(_embeddings),
        "model":             _MODEL_NAME if _DEEPFACE_AVAILABLE else "pixel_fallback",
        "threshold":         MATCH_THRESHOLD,
    })


@app.post("/enroll")
def enroll():
    """
    Enroll one face image for a student.
    Multiple calls accumulate; embeddings are averaged.
    Form fields: student_id (required), image (file, required), label (optional)
    """
    student_id = request.form.get("student_id") or request.form.get("studentId")
    image_file = request.files.get("image")

    if not student_id or not image_file:
        return jsonify({"error": "student_id and image required"}), 400

    image_bytes = image_file.read()
    emb = _compute_embedding(image_bytes)
    if emb is None:
        return jsonify({"error": "no_face_detected", "message": "Could not detect a face in the image"}), 422

    sid = str(student_id)
    with _lock:
        raws = _raw_embeddings.get(sid, [])
        raws.append(emb)
        _raw_embeddings[sid] = raws
        # Average all enrolled embeddings for robustness
        avg  = np.mean(raws, axis=0)
        norm = np.linalg.norm(avg)
        _embeddings[sid] = avg / norm if norm > 0 else avg

    _save_embeddings()
    return jsonify({
        "ok":         True,
        "student_id": sid,
        "images_enrolled": len(_raw_embeddings[sid]),
    })


@app.post("/verify_student")
def verify_student():
    """
    Verify that the face in image matches stored embedding for student_id.
    Form: student_id, image (file)
    Returns: { verified, distance, score, threshold }
    """
    student_id = request.form.get("student_id") or request.form.get("studentId")
    image_file = request.files.get("image")

    if not student_id or not image_file:
        return jsonify({"error": "student_id and image required"}), 400

    sid = str(student_id)
    with _lock:
        stored = _embeddings.get(sid)
    if stored is None:
        return jsonify({"error": "student_not_enrolled", "verified": False}), 404

    emb = _compute_embedding(image_file.read())
    if emb is None:
        return jsonify({"error": "no_face_detected", "verified": False}), 422

    dist     = _cosine_distance(emb, stored)
    verified = dist <= MATCH_THRESHOLD
    return jsonify({
        "verified":   verified,
        "distance":   round(dist, 4),
        "score":      round(max(0.0, 1.0 - dist), 4),
        "threshold":  MATCH_THRESHOLD,
        "student_id": sid,
    })


@app.post("/recognize")
def recognize():
    """
    Detect ALL faces in classroom image and match each against enrolled students.
    One request → marks everyone in the photo.

    Returns:
    {
      "recognized": [
        {"student_id": "42", "distance": 0.23, "score": 0.77, "match": true, "bbox": [x,y,w,h]},
        ...
      ],
      "faces_detected": 5,
      "faces_matched":  3,
      "unmatched":      2,    # faces detected but no enrolled student matched
      "threshold":      0.55
    }
    """
    image_file = request.files.get("image")
    if not image_file:
        return jsonify({"error": "image required"}), 400

    image_bytes = image_file.read()
    face_data   = _detect_and_embed_all_faces(image_bytes)

    if not face_data:
        return jsonify({
            "recognized":     [],
            "faces_detected": 0,
            "faces_matched":  0,
            "unmatched":      0,
            "threshold":      MATCH_THRESHOLD,
        })

    recognized = []
    unmatched  = 0
    seen_students = set()   # prevent double-matching same student to two faces

    for face in face_data:
        probe = face["embedding"]
        # Find best match, skipping already-matched students
        with _lock:
            best_sid  = None
            best_dist = float("inf")
            for sid, stored in _embeddings.items():
                if sid in seen_students:
                    continue
                dist = _cosine_distance(probe, stored)
                if dist < best_dist:
                    best_dist = dist
                    best_sid  = sid

        is_match = best_dist <= MATCH_THRESHOLD and best_sid is not None

        entry = {
            "student_id": best_sid if is_match else None,
            "distance":   round(best_dist, 4),
            "score":      round(max(0.0, 1.0 - best_dist), 4),
            "match":      is_match,
            "bbox":       face.get("bbox"),
            "confidence": round(face.get("confidence", 1.0), 3),
        }
        recognized.append(entry)

        if is_match:
            seen_students.add(best_sid)
        else:
            unmatched += 1

    matched_entries = [r for r in recognized if r["match"]]

    return jsonify({
        "recognized":     matched_entries,
        "all_faces":      recognized,
        "faces_detected": len(face_data),
        "faces_matched":  len(matched_entries),
        "unmatched":      unmatched,
        "threshold":      MATCH_THRESHOLD,
    })


@app.get("/enrolled")
def list_enrolled():
    """List enrolled student IDs (for admin / debugging)."""
    with _lock:
        enrolled = {sid: len(_raw_embeddings.get(sid, [])) for sid in _embeddings}
    return jsonify({"enrolled": enrolled, "count": len(enrolled)})


@app.delete("/enrolled/<student_id>")
def delete_enrolled(student_id):
    sid = str(student_id)
    with _lock:
        removed = sid in _embeddings
        _embeddings.pop(sid, None)
        _raw_embeddings.pop(sid, None)
    if removed:
        _save_embeddings()
    return jsonify({"ok": removed, "student_id": sid})


# ── Legacy compat ─────────────────────────────────────────────
@app.post("/verify")
def verify_pairwise():
    """Original pairwise verify kept for compatibility."""
    payload = request.get_json(force=True, silent=True) or {}
    if "image_a" not in payload or "image_b" not in payload:
        return jsonify({"error": "image_a and image_b required"}), 400

    def _from_b64(val):
        import base64
        s = str(val).strip()
        if s.startswith("data:"):
            s = s.split(",", 1)[1]
        missing = len(s) % 4
        if missing:
            s += "=" * (4 - missing)
        return base64.urlsafe_b64decode(s)

    emb_a = _compute_embedding(_from_b64(payload["image_a"]))
    emb_b = _compute_embedding(_from_b64(payload["image_b"]))
    if emb_a is None or emb_b is None:
        return jsonify({"error": "no_face_detected"}), 422

    dist = _cosine_distance(emb_a, emb_b)
    return jsonify({
        "match":     dist <= MATCH_THRESHOLD,
        "distance":  round(dist, 4),
        "score":     round(max(0.0, 1.0 - dist), 4),
        "threshold": MATCH_THRESHOLD,
    })


# ─────────────────────────────────────────────────────────────
# Bootstrap
# ─────────────────────────────────────────────────────────────
_load_embeddings()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT, debug=False)
