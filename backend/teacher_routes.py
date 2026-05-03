"""
Teacher routes — course management, session control, attendance history.
"""
from datetime import datetime, timezone
import re

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from sqlalchemy import func, and_
from sqlalchemy.orm import joinedload

from cache import cache_response, invalidate_cache
from extensions import db, limiter
from models import Course, Session, Attendance, Student, StudentCourse, Teacher, FaceEmbedding

teacher_bp = Blueprint("teacher", __name__)


def _teacher_required(fn):
    """Decorator: reject non-teachers."""
    from functools import wraps
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        claims = get_jwt()
        if claims.get("role") != "teacher":
            return jsonify({"error": "Teacher access required"}), 403
        return fn(*args, **kwargs)
    return wrapper


def _get_teacher(user_id: int) -> Teacher | None:
    return Teacher.query.filter_by(user_id=user_id).first()


@teacher_bp.route("/profile", methods=["GET"])
@_teacher_required
def teacher_profile():
    teacher = _get_teacher(int(get_jwt_identity()))
    if not teacher:
        return jsonify({"error": "teacher profile not found"}), 404
    profile = teacher.to_dict()
    profile["username"] = teacher.user.username if teacher.user else None
    return jsonify(profile)


# ── Courses ───────────────────────────────────────────────────
@teacher_bp.route("/courses", methods=["GET"])
@_teacher_required
@cache_response(ttl=30)
def list_courses():
    teacher = _get_teacher(int(get_jwt_identity()))
    if not teacher:
        return jsonify({"error": "teacher profile not found"}), 404

    courses = Course.query.filter_by(staff_id=teacher.staff_id).all()
    return jsonify([c.to_dict() for c in courses])


@teacher_bp.route("/classes", methods=["POST"])
@_teacher_required
def create_class():
    teacher = _get_teacher(int(get_jwt_identity()))
    if not teacher:
        return jsonify({"error": "teacher profile not found"}), 404

    data = request.get_json() or {}

    def _get_field(*keys):
        for key in keys:
            value = data.get(key)
            if value is not None:
                return value
        return None

    name = _get_field("class_name", "name", "subject", "className")
    if not name:
        return jsonify({"error": "name or class_name required"}), 400

    code = _get_field("code", "class_code", "subject", "class_name", "className") or name
    generated = re.sub(r"[^A-Za-z0-9]+", "", str(code or name)).upper()[:20]
    code = generated or f"CLASS{int(datetime.now().timestamp())}"
    if Course.query.filter_by(code=code).first():
        code = f"{code[:15]}{int(datetime.now().timestamp()) % 10000}"

    course = Course(
        code=code,
        name=name,
        section=_get_field("section"),
        schedule_info=_get_field("schedule_info", "scheduleInfo"),
        staff_id=teacher.staff_id,
        semester=_get_field("semester"),
        credits=_get_field("credits"),
    )
    db.session.add(course)
    db.session.commit()
    invalidate_cache("list_courses")
    invalidate_cache("list_classes")
    class_data = course.to_dict()
    return jsonify({"ok": True, "message": "class added", "class": class_data, "data": class_data}), 201


@teacher_bp.route("/course/add", methods=["POST"])
@_teacher_required
def add_course():
    teacher = _get_teacher(int(get_jwt_identity()))
    if not teacher:
        return jsonify({"error": "teacher profile not found"}), 404

    data = request.get_json() or {}

    def _get_field(*keys):
        for key in keys:
            value = data.get(key)
            if value is not None:
                return value
        return None

    code = _get_field("code", "class_code", "className")
    name = _get_field("name", "class_name", "subject")
    if not (code and name):
        return jsonify({"error": "code and name required"}), 400

    if Course.query.filter_by(code=code).first():
        return jsonify({"error": f"course code '{code}' already exists"}), 409

    course = Course(
        code=code,
        name=name,
        section=_get_field("section"),
        schedule_info=_get_field("schedule_info", "scheduleInfo"),
        staff_id=teacher.staff_id,
        semester=_get_field("semester"),
        credits=_get_field("credits"),
    )
    db.session.add(course)
    db.session.commit()
    invalidate_cache("list_courses")
    invalidate_cache("list_classes")
    return jsonify({"message": "course added", **course.to_dict()}), 201


@teacher_bp.route("/course/<int:course_id>", methods=["GET"])
@_teacher_required
@cache_response(ttl=30)
def course_details(course_id):
    course = Course.query.get_or_404(course_id)
    total_sessions = Session.query.filter_by(course_id=course_id).count()
    total_att = (
        db.session.query(func.count(Attendance.attendance_id))
        .join(Session, Attendance.session_id == Session.session_id)
        .filter(Session.course_id == course_id)
        .scalar() or 0
    )
    present_att = (
        db.session.query(func.count(Attendance.attendance_id))
        .join(Session, Attendance.session_id == Session.session_id)
        .filter(Session.course_id == course_id, Attendance.status == "Present")
        .scalar() or 0
    )
    avg = round((present_att / total_att) * 100, 2) if total_att else 0

    return jsonify({
        **course.to_dict(),
        "avg_attendance":  avg,
        "sessions_count":  total_sessions,
    })


@teacher_bp.route("/course/<int:course_id>/students", methods=["GET"])
@_teacher_required
@cache_response(ttl=30)
def list_course_students(course_id):
    Course.query.get_or_404(course_id)
    scs = (
        StudentCourse.query
        .options(joinedload(StudentCourse.student))
        .filter_by(course_id=course_id)
        .all()
    )
    student_ids = [sc.student_id for sc in scs]
    attendance_counts = {
        row[0]: row[1]
        for row in db.session.query(Attendance.student_id, func.count(Attendance.attendance_id))
        .filter(Attendance.student_id.in_(student_ids))
        .group_by(Attendance.student_id)
        .all()
    }
    students = [
        {
            **sc.student.to_dict(),
            "face_enrolled": sc.student.face_enrolled,
            "attendance_count": attendance_counts.get(sc.student_id, 0),
        }
        for sc in scs
    ]
    return jsonify(students)
@teacher_bp.route("/classes", methods=["GET"])
@_teacher_required
@cache_response(ttl=30)
def list_classes():
    teacher = _get_teacher(int(get_jwt_identity()))
    if not teacher:
        return jsonify({"error": "teacher profile not found"}), 404

    class_id = request.args.get("class_id")
    with_students = request.args.get("with_students") in ("1", "true", "yes")

    if class_id:
        course = Course.query.filter_by(course_id=int(class_id), staff_id=teacher.staff_id).first()
        if not course:
            return jsonify({"error": "class not found"}), 404

        students = [
            {
                "id": sc.student.student_id,
                "name": sc.student.name,
                "roll_no": sc.student.roll_no,
                "email": sc.student.email,
                "face_enrolled": sc.student.face_enrolled,
            }
            for sc in StudentCourse.query.options(joinedload(StudentCourse.student)).filter_by(course_id=course.course_id).all()
        ]
        return jsonify({
            "ok": True,
            "data": {
                "class": {
                    **course.to_dict(),
                    "student_count": len(students),
                },
                "students": students,
            },
        })

    courses = Course.query.filter_by(staff_id=teacher.staff_id).all()
    course_ids = [c.course_id for c in courses]
    counts = {
        row[0]: row[1]
        for row in db.session.query(StudentCourse.course_id, func.count(StudentCourse.id))
        .filter(StudentCourse.course_id.in_(course_ids))
        .group_by(StudentCourse.course_id)
        .all()
    }
    response = [
        {
            **c.to_dict(),
            "student_count": counts.get(c.course_id, 0),
        }
        for c in courses
    ]
    return jsonify({"ok": True, "data": response, "classes": response})




# ── Attendance sessions ────────────────────────────────────────
@teacher_bp.route("/course/<int:course_id>/attendance/start", methods=["POST"])
@_teacher_required
def start_attendance(course_id):
    """
    Start a new attendance session.
    Optional body: { lat, lon, radius_meters }
    If lat/lon provided, uses those as the geofence anchor.
    """
    teacher = _get_teacher(int(get_jwt_identity()))
    if not teacher:
        return jsonify({"error": "teacher profile not found"}), 404

    # Close any lingering active session for this course
    old = Session.query.filter_by(course_id=course_id, active=True).first()
    if old:
        old.active   = False
        old.end_time = datetime.now(timezone.utc)

    data = request.get_json(silent=True) or {}
    lat    = data.get("lat")
    lon    = data.get("lon")
    radius = data.get("radius_meters")

    session = Session(
        course_id=course_id,
        staff_id=teacher.staff_id,
        latitude=lat,
        longitude=lon,
        radius_meters=radius,
    )
    db.session.add(session)
    db.session.commit()
    return jsonify({"message": "session started", **session.to_dict()}), 201


@teacher_bp.route("/course/<int:course_id>/attendance/stop", methods=["POST"])
@_teacher_required
def stop_attendance(course_id):
    session = Session.query.filter_by(course_id=course_id, active=True).first()
    if not session:
        return jsonify({"error": "No active session found"}), 404

    session.active   = False
    session.end_time = datetime.now(timezone.utc)
    db.session.commit()

    # Auto-mark all enrolled students who are still absent
    enrolled_ids = [sc.student_id for sc in StudentCourse.query.filter_by(course_id=course_id).all()]
    for sid in enrolled_ids:
        att = Attendance.query.filter_by(student_id=sid, session_id=session.session_id).first()
        if not att:
            db.session.add(Attendance(
                student_id=sid,
                session_id=session.session_id,
                status="Absent",
                method="Manual",
            ))
    db.session.commit()

    present = Attendance.query.filter_by(session_id=session.session_id, status="Present").count()
    total   = len(enrolled_ids)
    return jsonify({
        "message":    "session stopped",
        "session_id": session.session_id,
        "present":    present,
        "absent":     total - present,
        "total":      total,
    })


@teacher_bp.route("/course/<int:course_id>/attendance/history", methods=["GET"])
@_teacher_required
def attendance_history(course_id):
    sessions = (
        Session.query
        .filter_by(course_id=course_id)
        .order_by(Session.start_time.desc())
        .all()
    )
    result = []
    for s in sessions:
        atts = list(s.attendance)
        total   = len(atts)
        present = sum(1 for a in atts if a.status == "Present")
        result.append({
            **s.to_dict(),
            "status":                "Active" if s.active else "Completed",
            "total_students":        total,
            "present":               present,
            "attendance_percentage": round((present / total) * 100, 2) if total else 0,
        })
    return jsonify(result)


@teacher_bp.route("/course/<int:course_id>/attendance/export", methods=["GET"])
@_teacher_required
def export_attendance(course_id):
    """
    Return structured data for CSV export.
    Frontend (or the caller) handles the actual file download.
    """
    sessions = Session.query.filter_by(course_id=course_id).all()
    rows = []
    for s in sessions:
        for a in s.attendance:
            student = a.student
            rows.append({
                "session_id":  s.session_id,
                "date":        s.start_time.date().isoformat() if s.start_time else None,
                "student_id":  a.student_id,
                "roll_no":     student.roll_no if student else None,
                "name":        student.name    if student else None,
                "status":      a.status,
                "method":      a.method,
                "timestamp":   a.timestamp.isoformat() if a.timestamp else None,
            })
    return jsonify({"course_id": course_id, "rows": rows})


# ── Face enrollment ────────────────────────────────────────────
@teacher_bp.route("/student/<int:student_id>/enroll", methods=["POST"])
@_teacher_required
def enroll_face(student_id):
    """
    Enroll a student's face from one or more uploaded photos.
    Accepts multipart: image (one or multiple) + optional labels
    """
    from services.face_service_client import enroll_student_multi, enroll_student
    from models import FaceEmbedding

    student = Student.query.get_or_404(student_id)
    images  = request.files.getlist("image")  # allow multiple

    if not images:
        return jsonify({"error": "at least one image required"}), 400

    labels = request.form.getlist("label") or ["frontal"] * len(images)
    pairs  = [(img.read(), labels[i] if i < len(labels) else "frontal")
              for i, img in enumerate(images)]

    result = enroll_student_multi(str(student_id), pairs)
    if result.get("errors") and not result.get("enrolled"):
        return jsonify({"error": "enrollment failed", "details": result["errors"]}), 502

    student.face_enrolled = True
    db.session.commit()
    return jsonify({"message": "enrolled", **result})


# ── Teacher stats dashboard endpoint ─────────────────────────
@teacher_bp.route("/stats", methods=["GET"])
@_teacher_required
def teacher_stats():
    """Returns aggregate stats for the teacher's dashboard."""
    teacher = _get_teacher(int(get_jwt_identity()))
    if not teacher:
        return jsonify({"error": "teacher not found"}), 404

    from sqlalchemy import func

    total_courses = Course.query.filter_by(staff_id=teacher.staff_id).count()
    course_ids = [c.course_id for c in Course.query.filter_by(staff_id=teacher.staff_id).all()]

    total_students = 0
    if course_ids:
        total_students = (
            db.session.query(func.count(func.distinct(StudentCourse.student_id)))
            .filter(StudentCourse.course_id.in_(course_ids))
            .scalar() or 0
        )

    active_sessions = Session.query.filter_by(staff_id=teacher.staff_id, active=True).count()

    avg_attendance = 0.0
    if course_ids:
        total = (
            db.session.query(func.count(Attendance.attendance_id))
            .join(Session, Attendance.session_id == Session.session_id)
            .filter(Session.course_id.in_(course_ids))
            .scalar() or 0
        )
        present = (
            db.session.query(func.count(Attendance.attendance_id))
            .join(Session, Attendance.session_id == Session.session_id)
            .filter(Session.course_id.in_(course_ids), Attendance.status == "Present")
            .scalar() or 0
        )
        avg_attendance = round((present / total * 100), 1) if total > 0 else 0.0

    return jsonify({
        "total_courses":   total_courses,
        "total_students":  total_students,
        "active_sessions": active_sessions,
        "avg_attendance":  avg_attendance,
    })
