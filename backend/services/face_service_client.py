"""
Face-service HTTP client.

All functions call the FaceNet microservice and return dicts.
On any error they return {"error": "<message>"} rather than raising,
so callers can decide how to handle.
"""
import requests
from config import Config

_TIMEOUT = 15  # seconds


def _url(path: str) -> str:
    base = Config.FACE_SERVICE_URL.rstrip("/")
    return f"{base}{path}"


# ─────────────────────────────────────────────────────────────
# Enrollment
# ─────────────────────────────────────────────────────────────
def enroll_student(student_id: str, image_bytes: bytes, label: str = "frontal") -> dict:
    """
    Enroll (or re-enroll) a student face.
    Sends the image to /enroll on the FaceNet service.
    label: optional tag like 'frontal', 'left', 'right' for multi-angle enrollment
    """
    try:
        resp = requests.post(
            _url("/enroll"),
            files={"image": ("enroll.jpg", image_bytes, "image/jpeg")},
            data={"student_id": str(student_id), "label": label},
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.Timeout:
        return {"error": "face_service_timeout"}
    except requests.exceptions.ConnectionError as e:
        return {"error": "face_service_unreachable", "details": str(e)}
    except requests.exceptions.HTTPError as e:
        return {"error": "face_service_http_error", "details": str(e), "response_text": resp.text if 'resp' in locals() else None}
    except Exception as e:
        return {"error": str(e)}


def enroll_student_multi(student_id: str, images: list[tuple[bytes, str]]) -> dict:
    """
    Enroll multiple angles in one call.
    images: list of (image_bytes, label) — e.g. [(bytes, "frontal"), (bytes, "left")]
    """
    results = []
    errors = []
    for img_bytes, label in images:
        r = enroll_student(student_id, img_bytes, label)
        if r.get("error"):
            errors.append({"label": label, "error": r["error"]})
        else:
            results.append({"label": label, "ok": True})
    return {"enrolled": results, "errors": errors, "student_id": student_id}


def delete_student_enrollment(student_id: str) -> dict:
    """
    Remove a student's face embeddings from the FaceNet service.
    """
    try:
        resp = requests.delete(_url(f"/enrolled/{student_id}"), timeout=_TIMEOUT)
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.Timeout:
        return {"error": "face_service_timeout"}
    except requests.exceptions.ConnectionError as e:
        return {"error": "face_service_unreachable", "details": str(e)}
    except requests.exceptions.HTTPError as e:
        return {"error": "face_service_http_error", "details": str(e), "response_text": resp.text if 'resp' in locals() else None}
    except Exception as e:
        return {"error": str(e)}


# ─────────────────────────────────────────────────────────────
# Single-student verification
# ─────────────────────────────────────────────────────────────
def verify_student(student_id: str, image_bytes: bytes) -> dict:
    """
    Verify that the face in image_bytes matches student_id.
    Returns: {"verified": bool, "distance": float, "score": float}
    """
    try:
        resp = requests.post(
            _url("/verify_student"),
            files={"image": ("verify.jpg", image_bytes, "image/jpeg")},
            data={"student_id": str(student_id)},
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.Timeout:
        return {"error": "face_service_timeout"}
    except requests.exceptions.ConnectionError as e:
        return {"error": "face_service_unreachable", "details": str(e)}
    except requests.exceptions.HTTPError as e:
        return {"error": "face_service_http_error", "details": str(e), "response_text": resp.text if 'resp' in locals() else None}
    except Exception as e:
        return {"error": str(e)}


# ─────────────────────────────────────────────────────────────
# Batch / classroom recognition  ← MAIN attendance endpoint
# ─────────────────────────────────────────────────────────────
def recognize_faces(image_bytes: bytes) -> dict:
    """
    Send ONE classroom photo; service detects ALL faces and returns
    a list of matched student IDs.

    Expected response shape from the FaceNet service:
    {
      "recognized": [
        {"student_id": "42", "distance": 0.28, "score": 0.72, "match": true, "bbox": [x,y,w,h]},
        ...
      ],
      "faces_detected": 5,
      "faces_matched": 3,
      "threshold": 0.55
    }
    """
    try:
        resp = requests.post(
            _url("/recognize"),
            files={"image": ("frame.jpg", image_bytes, "image/jpeg")},
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.Timeout:
        return {"error": "face_service_timeout"}
    except requests.exceptions.ConnectionError as e:
        return {"error": "face_service_unreachable", "details": str(e)}
    except requests.exceptions.HTTPError as e:
        return {"error": "face_service_http_error", "details": str(e), "response_text": resp.text if 'resp' in locals() else None}
    except Exception as e:
        return {"error": str(e)}


def health_check() -> bool:
    """Returns True if FaceNet service is reachable."""
    try:
        resp = requests.get(_url("/health"), timeout=5)
        return resp.status_code == 200
    except Exception:
        return False
