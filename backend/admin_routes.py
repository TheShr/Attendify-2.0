"""
Admin routes — system stats, user lists, admin registration.
All endpoints require admin role except /register (public, first-time setup).
"""
from functools import wraps
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt

from cache import cache_response
from extensions import db, limiter
from models import User, Student, Teacher, Session

from services.face_service_client import delete_student_enrollment

admin_bp = Blueprint("admin", __name__)


def _admin_required(fn):
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        claims = get_jwt()
        if claims.get("role") != "admin":
            return jsonify({"error": "admin access required"}), 403
        return fn(*args, **kwargs)
    return wrapper


# ── Public admin self-registration ───────────────────────────
@admin_bp.route("/register", methods=["POST"])
def register_admin():
    """
    Create the first admin account. In production you may want to
    restrict this to a one-time token or disable it after first use.
    """
    username = ""
    password = ""
    admin_photo = None

    if request.content_type and request.content_type.startswith("multipart/form-data"):
        form = request.form
        username = form.get("username", "").strip()
        password = form.get("password", "")
        admin_photo = request.files.get("photo")
    else:
        data = request.get_json() or {}
        username = data.get("username", "").strip()
        password = data.get("password", "")

    if not username or not password:
        return jsonify({"error": "username and password required"}), 400
    if len(password) < 6:
        return jsonify({"error": "password must be at least 6 characters"}), 400
    if User.query.filter_by(username=username).first():
        return jsonify({"error": "username already exists"}), 409

    user = User(username=username, role="admin")
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    response = {"message": "admin account created", "user_id": user.user_id}

    if admin_photo:
        from services.face_service_client import enroll_student

        try:
            result = enroll_student(f"admin-{user.user_id}", admin_photo.read(), label="frontal")
            if result.get("error"):
                response["face_enrolled"] = False
                response["face_error"] = result["error"]
            else:
                response["face_enrolled"] = True
        except Exception as exc:
            response["face_enrolled"] = False
            response["face_error"] = str(exc)

    return jsonify(response), 201


# ── System stats ──────────────────────────────────────────────
@admin_bp.route("/stats", methods=["GET"])
@_admin_required
@limiter.limit("30 per minute")
@cache_response(ttl=30)
def system_stats():
    total_students = Student.query.count()
    total_teachers = Teacher.query.count()
    active_sessions = Session.query.filter_by(active=True).count()
    return jsonify({
        "total_students":  total_students,
        "total_teachers":  total_teachers,
        "active_sessions": active_sessions,
        "system_health":   99,
    })


@admin_bp.route("/profile", methods=["GET"])
@_admin_required
def admin_profile():
    claims = get_jwt()
    user_id = claims.get("user_id")
    if not user_id:
        return jsonify({"error": "admin profile missing"}), 400
    user = User.query.get(user_id)
    if not user or user.role != "admin":
        return jsonify({"error": "admin profile not found"}), 404
    return jsonify({
        "user_id":   user.user_id,
        "username":  user.username,
        "role":      user.role,
        "last_login": user.last_login.isoformat() if user.last_login else None,
    })


# ── Student list ──────────────────────────────────────────────
@admin_bp.route("/students", methods=["GET"])
@_admin_required
@limiter.limit("30 per minute")
@cache_response(ttl=30)
def list_students():
    students = (
        db.session.query(Student, User.username)
        .join(User, Student.user_id == User.user_id)
        .all()
    )
    return jsonify({
        "students": [
            {
                "student_id": s.student_id,
                "roll_no":    s.roll_no,
                "name":       s.name,
                "email":      s.email,
                "class_code": s.class_code,
                "username":   username,
            }
            for s, username in students
        ]
    })


# ── Teacher list ──────────────────────────────────────────────
@admin_bp.route("/teachers", methods=["GET"])
@_admin_required
@limiter.limit("30 per minute")
@cache_response(ttl=30)
def list_teachers():
    teachers = (
        db.session.query(Teacher, User.username)
        .join(User, Teacher.user_id == User.user_id)
        .all()
    )
    return jsonify({
        "teachers": [
            {
                "staff_id":    t.staff_id,
                "name":        t.name,
                "email":       t.email,
                "department":  t.department,
                "designation": t.designation,
                "username":    username,
            }
            for t, username in teachers
        ]
    })


# ── User list ─────────────────────────────────────────────────
@admin_bp.route("/users", methods=["GET"])
@_admin_required
@limiter.limit("30 per minute")
@cache_response(ttl=30)
def list_users():
    users = User.query.all()
    response = []
    for user in users:
        item = {
            "user_id":  user.user_id,
            "username": user.username,
            "role":     user.role,
            "name":     user.username,
            "email":    None,
        }

        if user.role == "student" and user.student:
            item["name"] = user.student.name
            item["email"] = user.student.email
            item["extra"] = {
                "roll_no":   user.student.roll_no,
                "class_code": user.student.class_code,
            }
        elif user.role == "teacher" and user.teacher:
            item["name"] = user.teacher.name
            item["email"] = user.teacher.email
            item["extra"] = {
                "department":  user.teacher.department,
                "designation": user.teacher.designation,
            }

        response.append(item)

    return jsonify({"users": response})


# ── Delete user ───────────────────────────────────────────────
@admin_bp.route("/user/<int:user_id>", methods=["DELETE"])
@_admin_required
def delete_user(user_id: int):
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "user not found"}), 404

    warning = None
    face_removed = False
    if user.role == "student" and user.student:
        try:
            result = delete_student_enrollment(str(user.student.student_id))
            if result.get("error"):
                warning = result["error"]
            else:
                face_removed = result.get("ok", False)
        except Exception as exc:
            warning = str(exc)

    db.session.delete(user)
    db.session.commit()

    response = {"message": "user deleted"}
    if warning:
        response["warning"] = warning
    if face_removed:
        response["face_removed"] = True
    return jsonify(response)
