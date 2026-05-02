"""
Auth routes — register / login / token refresh / role endpoint.
Uses werkzeug password hashing (consistent with models.py).
"""
import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token, jwt_required, get_jwt, get_jwt_identity
)

from config import Config
from extensions import db, limiter
from models import User, Student, Teacher
from tasks import enqueue_face_enrollment

auth_bp = Blueprint("auth", __name__)


def _make_token(user: User) -> str:
    return create_access_token(
        identity=str(user.user_id),
        additional_claims={"role": user.role, "user_id": user.user_id},
        expires_delta=datetime.timedelta(hours=Config.JWT_ACCESS_TOKEN_EXPIRES_HOURS),
    )


# ── Register student ─────────────────────────────────────────
@auth_bp.route("/register/student", methods=["POST"])
@limiter.limit("10 per minute")
def register_student():
    """
    Register a student and optionally enroll their face.
    Accepts both JSON (no face) and multipart/form-data (with optional photo).
    """
    print("[Auth] register_student headers:", dict(request.headers))
    print("[Auth] register_student content_type:", request.content_type)
    print("[Auth] register_student origin:", request.headers.get("Origin"))

    username   = ""
    password   = ""
    roll_no    = ""
    name       = ""
    class_code = ""
    email      = None
    phone      = None
    photos     = []

    if request.content_type and request.content_type.startswith("multipart/form-data"):
        # Handle multipart form data (with optional photos)
        form = request.form
        username   = form.get("username", "").strip()
        password   = form.get("password", "")
        roll_no    = form.get("roll_no", "").strip()
        name       = form.get("name", "").strip()
        class_code = form.get("class_code", "").strip()
        email      = form.get("email", "").strip() or None
        phone      = form.get("phone", "").strip() or None
        photos     = request.files.getlist("photo")
    elif request.files:
        # Fallback if files were parsed even without a strict multipart content type.
        form = request.form
        username   = form.get("username", "").strip()
        password   = form.get("password", "")
        roll_no    = form.get("roll_no", "").strip()
        name       = form.get("name", "").strip()
        class_code = form.get("class_code", "").strip()
        email      = form.get("email", "").strip() or None
        phone      = form.get("phone", "").strip() or None
        photos     = request.files.getlist("photo")
    else:
        # Handle JSON request (legacy, no face)
        data       = request.get_json(silent=True) or {}
        username   = data.get("username", "").strip()
        password   = data.get("password", "")
        roll_no    = data.get("roll_no", "").strip()
        name       = data.get("name", "").strip()
        class_code = data.get("class_code", "").strip()
        email      = data.get("email", "").strip() or None
        phone      = data.get("phone", "").strip() or None

    if not all([username, password, roll_no, name, class_code]):
        return jsonify({"error": "username, password, roll_no, name, class_code required"}), 400
    if len(password) < 6:
        return jsonify({"error": "password must be at least 6 characters"}), 400
    if User.query.filter_by(username=username).first():
        return jsonify({"error": "username already exists"}), 409
    if Student.query.filter_by(roll_no=roll_no).first():
        return jsonify({"error": "roll_no already registered"}), 409

    user = User(username=username, role="student")
    user.set_password(password)
    db.session.add(user)
    db.session.flush()

    student = Student(
        user_id=user.user_id,
        roll_no=roll_no,
        name=name,
        class_code=class_code,
        email=email,
        phone=phone,
    )
    db.session.add(student)
    db.session.commit()

    response = {
        "message": "student registered",
        "user_id": user.user_id,
        "student_id": student.student_id,
        "face_enrolled": False,
        "enrolled_images": 0,
    }

    # Enroll face images if provided
    if photos:
        images = [
            (photo.read(), f"photo-{idx + 1}")
            for idx, photo in enumerate(photos)
            if photo and hasattr(photo, "read")
        ]

        if not images:
            response["face_error"] = "no_valid_photos_uploaded"
        elif Config.USE_ASYNC_FACE_ENROLLMENT:
            try:
                job_id = enqueue_face_enrollment(str(student.student_id), images)
                response["face_enrollment_job"] = job_id
                response["face_enrollment"] = "queued"
            except Exception as exc:
                response["face_error"] = str(exc)
        else:
            from services.face_service_client import enroll_student_multi

            try:
                enroll_result = enroll_student_multi(str(student.student_id), images)
                enrolled = enroll_result.get("enrolled", [])
                errors = enroll_result.get("errors", [])
                if enrolled:
                    student.face_enrolled = True
                    db.session.commit()
                    response["face_enrolled"] = True
                response["enrolled_images"] = len(enrolled)
                if errors:
                    response["face_errors"] = errors
                if not enrolled and not errors:
                    response["face_error"] = "no_valid_photos_uploaded"
            except Exception as exc:
                response["face_enrolled"] = False
                response["face_error"] = str(exc)

    return jsonify(response), 201


# ── Register teacher ─────────────────────────────────────────
@auth_bp.route("/register/teacher", methods=["POST"])
@limiter.limit("10 per minute")
def register_teacher():
    data = request.get_json(silent=True)
    if data is None:
        data = {}
    if not data and request.form:
        data = request.form.to_dict(flat=True)

    username = data.get("username", "").strip()
    password = data.get("password", "")
    name     = data.get("name", "").strip()
    email    = data.get("email", "").strip()

    if not all([username, password, name, email]):
        return jsonify({"error": "username, password, name, email required"}), 400
    if len(password) < 6:
        return jsonify({"error": "password must be at least 6 characters"}), 400
    if User.query.filter_by(username=username).first():
        return jsonify({"error": "username already exists"}), 409
    if Teacher.query.filter_by(email=email).first():
        return jsonify({"error": "email already registered"}), 409

    user = User(username=username, role="teacher")
    user.set_password(password)
    db.session.add(user)
    db.session.flush()

    teacher = Teacher(
        user_id=user.user_id, name=name, email=email,
        phone=(data.get("phone", "") or "").strip() or None,
        department=(data.get("department", "") or "").strip() or None,
        designation=(data.get("designation", "") or "").strip() or None,
    )
    db.session.add(teacher)
    db.session.commit()

    return jsonify({"message": "teacher registered", "user_id": user.user_id, "staff_id": teacher.staff_id}), 201


# ── Register admin (admin-only endpoint after first admin) ────
@auth_bp.route("/register/admin", methods=["POST"])
def register_admin():
    data     = request.get_json() or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not (username and password):
        return jsonify({"error": "username and password required"}), 400
    if User.query.filter_by(username=username).first():
        return jsonify({"error": "username already exists"}), 409

    user = User(username=username, role="admin")
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    return jsonify({"message": "admin registered", "user_id": user.user_id}), 201


# ── Login ─────────────────────────────────────────────────────
@auth_bp.route("/login", methods=["POST"])
@limiter.limit("15 per minute")
def login():
    try:
        data     = request.get_json() or {}
        username = data.get("username", "").strip()
        password = data.get("password", "")

        if not (username and password):
            return jsonify({"error": "username and password required"}), 400

        user = User.query.filter_by(username=username).first()
        if not user or not user.check_password(password):
            return jsonify({"error": "invalid credentials"}), 401

        # Update last_login
        from datetime import timezone
        user.last_login = datetime.datetime.now(timezone.utc)
        db.session.commit()

        token = _make_token(user)

        # attach profile data for convenience
        profile = {}
        if user.student:
            profile = {"student_id": user.student.student_id, "name": user.student.name,
                       "roll_no": user.student.roll_no, "class_code": user.student.class_code}
        elif user.teacher:
            profile = {"staff_id": user.teacher.staff_id, "name": user.teacher.name,
                       "department": user.teacher.department}

        return jsonify({
            "access_token": token,
            "role":         user.role,
            "user_id":      user.user_id,
            **profile,
        })
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": "Internal server error"}), 500


# ── Whoami ────────────────────────────────────────────────────
@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def whoami():
    claims  = get_jwt()
    user_id = int(get_jwt_identity())
    user    = User.query.get_or_404(user_id)

    profile = {}
    if user.student:
        profile = user.student.to_dict()
    elif user.teacher:
        profile = user.teacher.to_dict()

    return jsonify({"user_id": user_id, "role": claims.get("role"), "username": user.username, **profile})


# ── Legacy role endpoint ──────────────────────────────────────
@auth_bp.route("/role", methods=["GET"])
@jwt_required()
def get_role():
    claims = get_jwt()
    return jsonify({"role": claims.get("role"), "user_id": claims.get("user_id")})
