"""
Student routes — courses, attendance, profile.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from sqlalchemy import func, and_
from sqlalchemy.orm import joinedload

from cache import cache_response
from extensions import db, limiter
from models import Student, StudentCourse, Course, Attendance, Session, Notification

student_bp = Blueprint("student", __name__)


def _student_required(fn):
    from functools import wraps
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        claims = get_jwt()
        if claims.get("role") != "student":
            return jsonify({"error": "Student access required"}), 403
        return fn(*args, **kwargs)
    return wrapper


def _get_student(user_id: int) -> Student | None:
    return Student.query.filter_by(user_id=user_id).first()


@student_bp.route("/profile", methods=["GET"])
@_student_required
def profile():
    student = _get_student(int(get_jwt_identity()))
    if not student:
        return jsonify({"error": "profile not found"}), 404
    return jsonify(student.to_dict())


@student_bp.route("/courses", methods=["GET"])
@_student_required
@cache_response(ttl=30)
def student_courses():
    student = _get_student(int(get_jwt_identity()))
    if not student:
        return jsonify({"error": "profile not found"}), 404

    enrolled_courses = (
        db.session.query(Course)
        .join(StudentCourse, StudentCourse.course_id == Course.course_id)
        .options(joinedload(Course.teacher))
        .filter(StudentCourse.student_id == student.student_id)
        .all()
    )
    course_ids = [c.course_id for c in enrolled_courses]

    session_counts = {
        row[0]: row[1]
        for row in db.session.query(Session.course_id, func.count(Session.session_id))
        .filter(Session.course_id.in_(course_ids))
        .group_by(Session.course_id)
        .all()
    }
    present_counts = {
        row[0]: row[1]
        for row in db.session.query(Course.course_id, func.count(Attendance.attendance_id))
        .join(Session, Session.course_id == Course.course_id)
        .join(Attendance, and_(Attendance.session_id == Session.session_id, Attendance.student_id == student.student_id, Attendance.status == "Present"))
        .filter(Course.course_id.in_(course_ids))
        .group_by(Course.course_id)
        .all()
    }

    courses = [
        {
            **c.to_dict(),
            "attendance_percent": round((present_counts.get(c.course_id, 0) / session_counts.get(c.course_id, 0)) * 100, 2) if session_counts.get(c.course_id) else None,
            "sessions_total": session_counts.get(c.course_id, 0),
            "sessions_present": present_counts.get(c.course_id, 0),
            "teacher_name": c.teacher.name if c.teacher else None,
            "schedule_info": c.schedule_info,
            "section": c.section,
        }
        for c in enrolled_courses
    ]
    return jsonify(courses)


@student_bp.route("/course/<int:course_id>/attendance", methods=["GET"])
@_student_required
@cache_response(ttl=30)
def course_attendance(course_id):
    student = _get_student(int(get_jwt_identity()))
    if not student:
        return jsonify({"error": "profile not found"}), 404

    sessions = Session.query.filter_by(course_id=course_id).order_by(Session.start_time.desc()).all()
    session_ids = [s.session_id for s in sessions]
    attendance_map = {
        a.session_id: a
        for a in Attendance.query.filter(
            Attendance.session_id.in_(session_ids),
            Attendance.student_id == student.student_id,
        ).all()
    }
    result = [
        {
            "session_id": s.session_id,
            "start_time": s.start_time.isoformat() if s.start_time else None,
            "end_time":   s.end_time.isoformat()   if s.end_time   else None,
            "status":     attendance_map.get(s.session_id).status if attendance_map.get(s.session_id) else "Absent",
            "method":     attendance_map.get(s.session_id).method if attendance_map.get(s.session_id) else None,
        }
        for s in sessions
    ]
    return jsonify(result)


@student_bp.route("/attendance/summary", methods=["GET"])
@_student_required
def attendance_summary():
    student = _get_student(int(get_jwt_identity()))
    if not student:
        return jsonify({"error": "profile not found"}), 404

    total   = Attendance.query.filter_by(student_id=student.student_id).count()
    present = Attendance.query.filter_by(student_id=student.student_id, status="Present").count()
    return jsonify({
        "student_id":         student.student_id,
        "total_sessions":     total,
        "present":            present,
        "absent":             total - present,
        "attendance_percent": round((present / total) * 100, 2) if total else 0,
    })


@student_bp.route("/attendance/latest", methods=["GET"])
@_student_required
def latest_attendance():
    student = _get_student(int(get_jwt_identity()))
    if not student:
        return jsonify({"error": "profile not found"}), 404

    enrolled_ids = [sc.course_id for sc in student.student_courses]
    active_session = (
        Session.query
        .filter(Session.active == True, Session.course_id.in_(enrolled_ids))
        .order_by(Session.start_time.desc())
        .first()
    )
    if not active_session:
        return jsonify({"message": "No active session"}), 404

    att = Attendance.query.filter_by(
        session_id=active_session.session_id, student_id=student.student_id
    ).first()
    return jsonify({
        "session_id":  active_session.session_id,
        "course_id":   active_session.course_id,
        "status":      att.status if att else "Not marked",
        "start_time":  active_session.start_time.isoformat(),
        "geo_lat":     float(active_session.latitude)  if active_session.latitude  else None,
        "geo_lon":     float(active_session.longitude) if active_session.longitude else None,
        "radius":      float(active_session.radius_meters) if active_session.radius_meters else None,
    })


@student_bp.route("/notifications", methods=["GET"])
@_student_required
def notifications():
    student = _get_student(int(get_jwt_identity()))
    if not student:
        return jsonify({"error": "profile not found"}), 404

    notifs = (
        Notification.query
        .filter_by(user_id=student.user_id)
        .order_by(Notification.created_at.desc())
        .limit(50)
        .all()
    )
    return jsonify([n.to_dict() for n in notifs])


@student_bp.route("/notifications/<int:nid>/read", methods=["POST"])
@_student_required
def mark_notification_read(nid):
    notif = Notification.query.get_or_404(nid)
    notif.read_status = True
    db.session.commit()
    return jsonify({"ok": True})


# ── Student dashboard stats ───────────────────────────────────
@student_bp.route("/stats", methods=["GET"])
@_student_required
@cache_response(ttl=30)
def student_stats():
    """Aggregate stats for student dashboard."""
    student = _get_student(int(get_jwt_identity()))
    if not student:
        return jsonify({"error": "student not found"}), 404

    from datetime import datetime, timedelta, timezone

    total_classes = Attendance.query.filter_by(student_id=student.student_id).count()
    classes_attended = Attendance.query.filter_by(student_id=student.student_id, status="Present").count()
    overall_pct = round((classes_attended / total_classes * 100), 2) if total_classes > 0 else 0.0

    now = datetime.now(timezone.utc)
    week_start = now - timedelta(days=now.weekday())
    this_week_records = Attendance.query.filter(
        Attendance.student_id == student.student_id,
        Attendance.timestamp >= week_start,
    ).all()
    this_week_attended = sum(1 for r in this_week_records if r.status == "Present")
    this_week_total = len(this_week_records)

    days_present = {
        r.timestamp.date()
        for r in this_week_records
        if r.status == "Present" and r.timestamp
    }
    streak = 0
    check_day = now.date()
    while check_day in days_present:
        streak += 1
        check_day -= timedelta(days=1)

    return jsonify({
        "overall_attendance":  overall_pct,
        "classes_attended":    classes_attended,
        "total_classes":       total_classes,
        "this_week_attended":  this_week_attended,
        "this_week_total":     this_week_total,
        "streak":              streak,
    })
