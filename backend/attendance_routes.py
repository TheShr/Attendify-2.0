"""
Attendance routes — all attendance marking, history, analytics.

Face attendance flow (improved):
  1. Teacher starts a session (POST /api/teacher/course/:id/attendance/start)
     → session gets teacher's lat/lon anchored
  2. Teacher sends ONE classroom photo to POST /api/attendance/mark/face
     → backend calls FaceNet /recognize → gets list of ALL matched faces
     → for each face: server-side geofence check (uses teacher-anchored coords)
     → marks Present for those inside; returns who was marked & who wasn't
"""
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
import base64
import re

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from sqlalchemy import func, or_

from extensions import db, limiter
from models import Student, Session, Attendance, User, Course, StudentCourse, Teacher, Log
from services.geofence import within_geofence
from services.face_service_client import recognize_faces, verify_student
from cache import invalidate_cache

attendance_bp = Blueprint("attendance", __name__)


# ── helpers ──────────────────────────────────────────────────
def _role(claims): return claims.get("role", "")
def _is_teacher(c): return _role(c) == "teacher"
def _is_student(c): return _role(c) == "student"
def _is_admin(c):   return _role(c) == "admin"


def _log(user_id: int, action: str, ip: str = None, details: dict = None):
    try:
        log = Log(user_id=user_id, action=action, ip_address=ip, details=details)
        db.session.add(log)
    except Exception:
        pass  # never let logging break attendance


def _safe_decimal(val):
    if val is None:
        return None
    try:
        return Decimal(str(val))
    except (InvalidOperation, ValueError):
        return None


def _decode_image_payload(payload):
    if not payload:
        return None
    if isinstance(payload, (bytes, bytearray)):
        return bytes(payload)
    if isinstance(payload, str):
        match = re.match(r"^data:(?:image/[a-zA-Z+\-\.]+);base64,(.+)$", payload)
        if match:
            payload = match.group(1)
        try:
            return base64.b64decode(payload)
        except Exception:
            return None
    return None


# ══════════════════════════════════════════════════════════════
# Manual attendance
# ══════════════════════════════════════════════════════════════
@attendance_bp.route("/attendance/mark/manual", methods=["POST"])
@jwt_required()
def mark_manual():
    claims = get_jwt()
    if not _is_teacher(claims) and not _is_admin(claims):
        return jsonify({"error": "only teachers/admin can perform manual marking"}), 403

    data = request.get_json() or {}
    student_id = data.get("student_id")
    session_id = data.get("session_id")
    status     = data.get("status", "Present")
    caller_id  = int(get_jwt_identity())

    if not (student_id and session_id):
        return jsonify({"error": "student_id and session_id required"}), 400
    if status not in ("Present", "Absent", "Late"):
        return jsonify({"error": "status must be Present, Absent or Late"}), 400

    session = Session.query.get(session_id)
    if not session:
        return jsonify({"error": "session not found"}), 404

    att = Attendance.query.filter_by(student_id=student_id, session_id=session_id).first()
    if att:
        att.status    = status
        att.method    = "Manual"
        att.marked_by = caller_id
    else:
        att = Attendance(
            student_id=student_id, session_id=session_id,
            status=status, method="Manual", marked_by=caller_id,
        )
        db.session.add(att)

    _log(caller_id, "manual_attendance", details={"student_id": student_id, "status": status})
    db.session.commit()
    invalidate_cache("student_courses")
    invalidate_cache("course_attendance")
    invalidate_cache("student_stats")
    return jsonify({"message": "attendance recorded (manual)", "student_id": student_id, "session_id": session_id})


@attendance_bp.route("/attendance/manual", methods=["POST"])
@jwt_required()
@limiter.limit("50 per minute")
def manual_attendance():
    claims = get_jwt()
    if not _is_teacher(claims) and not _is_admin(claims):
        return jsonify({"error": "only teachers/admin can submit manual attendance"}), 403

    data = request.get_json() or {}
    class_id = data.get("classId") or data.get("class_id")
    date = data.get("date")
    time = data.get("time") or "00:00"
    records = data.get("records") or []
    caller_id = int(get_jwt_identity())

    if not class_id or not date or not records:
        return jsonify({"error": "classId, date and records are required"}), 400

    course = Course.query.get(class_id)
    if not course:
        return jsonify({"error": "course not found"}), 404
    if _is_teacher(claims):
        teacher = Teacher.query.filter_by(user_id=caller_id).first()
        if not teacher or course.staff_id != teacher.staff_id:
            return jsonify({"error": "forbidden"}), 403

    session = (
        Session.query
        .filter_by(course_id=course.course_id)
        .filter(func.date(Session.start_time) == date)
        .order_by(Session.start_time.desc())
        .first()
    )
    if not session:
        start_dt = datetime.fromisoformat(f"{date}T{time}")
        session = Session(
            course_id=course.course_id,
            staff_id=course.staff_id,
            start_time=start_dt,
            active=False,
        )
        db.session.add(session)
        db.session.flush()

    saved = 0
    updated = 0
    for record in records:
        student_id = record.get("studentId")
        status = record.get("status", "Present")
        if not student_id or status not in ("Present", "Absent", "Late"):
            continue
        enrolled = StudentCourse.query.filter_by(course_id=course.course_id, student_id=student_id).first()
        if not enrolled:
            continue

        att = Attendance.query.filter_by(student_id=student_id, session_id=session.session_id).first()
        if att:
            att.status = status
            att.method = "Manual"
            att.marked_by = caller_id
            updated += 1
        else:
            att = Attendance(
                student_id=student_id,
                session_id=session.session_id,
                status=status,
                method="Manual",
                marked_by=caller_id,
            )
            db.session.add(att)
            saved += 1

    _log(caller_id, "manual_attendance_batch", details={
        "class_id": class_id,
        "date": date,
        "saved": saved,
        "updated": updated,
    })
    db.session.commit()
    invalidate_cache("student_courses")
    invalidate_cache("course_attendance")
    invalidate_cache("student_stats")
    return jsonify({"ok": True, "created": saved, "updated": updated, "session_id": session.session_id})


@attendance_bp.route("/attendance/history", methods=["GET"])
@jwt_required()
def attendance_history():
    claims = get_jwt()
    if not _is_teacher(claims) and not _is_admin(claims):
        return jsonify({"error": "forbidden"}), 403

    class_id = request.args.get("class_id") or request.args.get("classId")
    course_id = int(class_id) if class_id and class_id.isdigit() else None
    start_date = request.args.get("start_date") or request.args.get("fromDate")
    end_date = request.args.get("end_date") or request.args.get("toDate")
    student_query = request.args.get("student")
    page = max(int(request.args.get("page", 1)), 1)
    page_size = min(max(int(request.args.get("page_size", 20)), 1), 100)

    query = Attendance.query.join(Session).join(Course).join(Student)
    if course_id:
        query = query.filter(Session.course_id == course_id)
    if start_date:
        query = query.filter(func.date(Session.start_time) >= start_date)
    if end_date:
        query = query.filter(func.date(Session.start_time) <= end_date)
    if student_query:
        like_term = f"%{student_query}%"
        query = query.filter(
            or_(Student.name.ilike(like_term), Student.roll_no.ilike(like_term), Student.email.ilike(like_term))
        )

    total = query.count()
    records = query.order_by(Attendance.timestamp.desc()).offset((page - 1) * page_size).limit(page_size).all()
    items = []
    for a in records:
        session = a.session
        items.append({
            "attendance_id": a.attendance_id,
            "session_id": a.session_id,
            "class_id": session.course_id if session else None,
            "class_name": session.course.name if session and session.course else None,
            "student_id": a.student_id,
            "student_name": a.student.name if a.student else None,
            "status": a.status,
            "method": a.method,
            "timestamp": a.timestamp.isoformat() if a.timestamp else None,
            "date": session.start_time.date().isoformat() if session and session.start_time else None,
            "time": session.start_time.strftime("%H:%M:%S") if session and session.start_time else None,
        })

    return jsonify({"ok": True, "items": items, "meta": {"page": page, "page_size": page_size, "total": total}})


# ══════════════════════════════════════════════════════════════
# Face-based attendance  (BATCH — single photo marks whole class)
# ══════════════════════════════════════════════════════════════
@attendance_bp.route("/attendance/mark/face", methods=["POST"])
@jwt_required()
@limiter.limit("30 per minute")
def mark_face():
    """
    Accept ONE classroom photo. Detect every face, match against enrolled
    students, do server-side geofence validation, mark attendance.

    Form fields:
      image        : the classroom photo (multipart file)
      session_id   : required
      lat          : teacher/device latitude  (used as geofence reference if session has none)
      lon          : teacher/device longitude
      accuracy     : GPS accuracy in metres (optional, improves geofence logic)
    """
    claims    = get_jwt()
    caller_id = int(get_jwt_identity())
    print(f"[Mark Face] Received request from user {caller_id}, content_type: {request.content_type}")

    data = request.get_json(silent=True) or {}
    session_id = request.form.get("session_id") or data.get("session_id")
    class_id = request.form.get("class_id") or request.form.get("classId") or data.get("class_id") or data.get("classId")
    print(f"[Mark Face] session_id={session_id}, class_id={class_id}")
    if not session_id and not class_id:
        return jsonify({"error": "session_id or class_id required"}), 400

    session = Session.query.get(session_id) if session_id else None
    if not session and class_id:
        session = (
            Session.query
            .filter(Session.course_id == int(class_id), Session.active == True)
            .order_by(Session.start_time.desc())
            .first()
        )
    if not session:
        print(f"[Mark Face] No session found for session_id={session_id}, class_id={class_id}")
        return jsonify({"error": "session not found"}), 404
    if not session.active:
        print(f"[Mark Face] Session {session.session_id} is not active")
        return jsonify({"error": "session is no longer active"}), 400

    image = request.files.get("image")
    if not image:
        image_payload = data.get("image") or request.form.get("image")
        image_bytes = _decode_image_payload(image_payload)
        if not image_bytes:
            return jsonify({"error": "image required"}), 400
    else:
        image_bytes = image.read()

    lat      = request.form.get("lat") or data.get("lat")
    lon      = request.form.get("lon") or data.get("lon")
    accuracy = request.form.get("accuracy") or data.get("accuracy")

    # ── call FaceNet recognize ────────────────────────────────
    face_result = recognize_faces(image_bytes)

    if face_result.get("error"):
        print(f"[Mark Face] Face service error: {face_result['error']}")
        if face_result.get("details"):
            print(f"[Mark Face] Face service details: {face_result['details']}")
        return jsonify({"error": "face_service_error", "details": face_result["error"], "details_text": face_result.get("details")}), 502

    all_results = face_result.get("recognized", [])
    faces_detected = face_result.get("faces_detected", len(all_results))

    # Only keep confirmed matches
    matched = [r for r in all_results if r.get("match") is True]
    matched_student_ids = []
    for r in matched:
        raw_id = r.get("student_id") or r.get("studentId")
        if raw_id is None:
            continue
        sid = str(raw_id).strip()
        if sid.isdigit():
            matched_student_ids.append(int(sid))

    student_map = {
        student.student_id: student
        for student in Student.query.filter(Student.student_id.in_(matched_student_ids)).all()
    }

    # ── determine geofence anchor ─────────────────────────────
    # Prefer session-stored location; fall back to posted lat/lon
    anchor_lat = float(session.latitude)  if session.latitude  else (_safe_decimal(lat)  and float(lat))
    anchor_lon = float(session.longitude) if session.longitude else (_safe_decimal(lon)  and float(lon))
    session_radius = float(session.radius_meters) if session.radius_meters else None

    marked     = []
    not_inside = []
    already    = []
    unknown    = []

    for r in matched:
        sid = str(r.get("student_id") or r.get("studentId") or "").strip()
        if not sid:
            continue

        student = student_map.get(int(sid)) if sid.isdigit() else None
        if not student:
            unknown.append(sid)
            continue

        # ── geofence check ─────────────────────────────────────
        # For face recognition from a camera the teacher holds,
        # the teacher's location is the geofence reference.
        # Students don't submit their own location here — the teacher
        # scans the whole room from one device. Geofence here means
        # "was the teacher/device inside the campus zone?".
        if anchor_lat and anchor_lon:
            geo = within_geofence(
                anchor_lat, anchor_lon,
                float(lat) if lat else anchor_lat,
                float(lon) if lon else anchor_lon,
                radius_meters=session_radius,
                user_accuracy_meters=float(accuracy) if accuracy else None,
            )
            if not geo.inside:
                not_inside.append(sid)
                continue

        # ── upsert attendance ──────────────────────────────────
        att = Attendance.query.filter_by(
            student_id=student.student_id, session_id=session.session_id
        ).first()

        if att and att.status == "Present":
            already.append(sid)
            continue

        distance_val = r.get("distance")
        if att:
            att.status        = "Present"
            att.method        = "Face"
            att.marked_by     = caller_id
            att.geo_lat       = _safe_decimal(lat)
            att.geo_long      = _safe_decimal(lon)
            att.face_distance = _safe_decimal(distance_val)
        else:
            att = Attendance(
                student_id=student.student_id,
                session_id=session.session_id,
                status="Present", method="Face",
                marked_by=caller_id,
                geo_lat=_safe_decimal(lat),
                geo_long=_safe_decimal(lon),
                face_distance=_safe_decimal(distance_val),
            )
            db.session.add(att)
        marked.append({"student_id": sid, "name": student.name, "distance": distance_val})

    _log(caller_id, "face_attendance", details={
        "session_id": session_id,
        "faces_detected": faces_detected,
        "marked_count": len(marked),
    })
    db.session.commit()
    invalidate_cache("student_courses")
    invalidate_cache("course_attendance")
    invalidate_cache("student_stats")

    return jsonify({
        "session_id":     session_id,
        "faces_detected": faces_detected,
        "faces_matched":  len(matched),
        "marked":         marked,
        "already_marked": already,
        "not_inside":     not_inside,
        "unknown_faces":  unknown,
    })


@attendance_bp.route("/attendance/mark", methods=["POST"])
@jwt_required()
def mark_face_alias():
    return mark_face()


@attendance_bp.route("/attendance/mark-face", methods=["POST"])
@jwt_required()
def mark_face_hyphen():
    return mark_face()


# ── single-student self-check-in (student scans own face) ─────
@attendance_bp.route("/attendance/checkin", methods=["POST"])
@jwt_required()
@limiter.limit("30 per minute")
def student_checkin():
    """
    Student opens app, scans their own face to check in.
    Requires: image, session_id, lat, lon (from student device)
    """
    claims    = get_jwt()
    caller_id = int(get_jwt_identity())

    student = Student.query.filter_by(user_id=caller_id).first()
    if not student:
        return jsonify({"error": "student profile not found"}), 404

    session_id = request.form.get("session_id")
    session = Session.query.get(session_id) if session_id else None
    if not session:
        # Auto-find most recent active session for any course this student is in
        enrolled_course_ids = [sc.course_id for sc in student.student_courses]
        session = (
            Session.query
            .filter(Session.active == True, Session.course_id.in_(enrolled_course_ids))
            .order_by(Session.start_time.desc())
            .first()
        )
    if not session:
        return jsonify({"error": "no active session found for your courses"}), 404
    if not session.active:
        return jsonify({"error": "session is no longer active"}), 400

    image = request.files.get("image")
    if not image:
        return jsonify({"error": "image required"}), 400

    lat      = request.form.get("lat")
    lon      = request.form.get("lon")
    accuracy = request.form.get("accuracy")

    # ── geofence check (student must be inside campus) ────────
    if session.latitude and session.longitude:
        if not lat or not lon:
            return jsonify({"error": "location required for attendance"}), 400
        geo = within_geofence(
            float(session.latitude), float(session.longitude),
            float(lat), float(lon),
            radius_meters=float(session.radius_meters) if session.radius_meters else None,
            user_accuracy_meters=float(accuracy) if accuracy else None,
        )
        if not geo.inside:
            return jsonify({
                "error":            "outside_geofence",
                "message":          "You are not inside the classroom geofence",
                "distance_meters":  round(geo.distance_meters, 1),
                "radius_meters":    round(geo.radius_meters, 1),
            }), 403

    # ── verify face ───────────────────────────────────────────
    image_bytes = image.read()
    verify_result = verify_student(str(student.student_id), image_bytes)

    if verify_result.get("error"):
        return jsonify({"error": "face_service_error", "details": verify_result["error"]}), 502

    verified = verify_result.get("verified", False) or verify_result.get("match", False)
    if not verified:
        return jsonify({
            "error":    "face_not_matched",
            "message":  "Your face could not be verified. Please try again or contact teacher.",
            "distance": verify_result.get("distance"),
        }), 400

    # ── upsert attendance ─────────────────────────────────────
    att = Attendance.query.filter_by(
        student_id=student.student_id, session_id=session.session_id
    ).first()

    if att and att.status == "Present":
        return jsonify({"message": "already marked present", "session_id": session.session_id}), 200

    distance_val = verify_result.get("distance")
    if att:
        att.status        = "Present"
        att.method        = "Face"
        att.marked_by     = caller_id
        att.geo_lat       = _safe_decimal(lat)
        att.geo_long      = _safe_decimal(lon)
        att.face_distance = _safe_decimal(distance_val)
    else:
        att = Attendance(
            student_id=student.student_id,
            session_id=session.session_id,
            status="Present", method="Face",
            marked_by=caller_id,
            geo_lat=_safe_decimal(lat),
            geo_long=_safe_decimal(lon),
            face_distance=_safe_decimal(distance_val),
        )
        db.session.add(att)

    db.session.commit()
    invalidate_cache("student_courses")
    invalidate_cache("course_attendance")
    invalidate_cache("student_stats")
    return jsonify({
        "message":    "attendance marked",
        "session_id": session.session_id,
        "course_id":  session.course_id,
        "distance":   distance_val,
    })


# ══════════════════════════════════════════════════════════════
# Read — student attendance history
# ══════════════════════════════════════════════════════════════
@attendance_bp.route("/attendance/student/<int:student_id>", methods=["GET"])
@jwt_required()
def get_student_attendance(student_id):
    claims    = get_jwt()
    requester = int(get_jwt_identity())

    if _role(claims) == "student":
        student = Student.query.filter_by(student_id=student_id).first()
        if not student or requester != student.user_id:
            return jsonify({"error": "forbidden"}), 403

    total   = db.session.query(func.count(Attendance.attendance_id)).filter(Attendance.student_id == student_id).scalar() or 0
    present = db.session.query(func.count(Attendance.attendance_id)).filter(
        Attendance.student_id == student_id, Attendance.status == "Present"
    ).scalar() or 0
    percent = round((present / total) * 100.0, 2) if total else 0.0

    history = (
        Attendance.query
        .filter_by(student_id=student_id)
        .order_by(Attendance.timestamp.desc())
        .all()
    )
    return jsonify({
        "student_id":         student_id,
        "attendance_percent": percent,
        "total":              total,
        "present":            present,
        "history":            [a.to_dict() for a in history],
    })


@attendance_bp.route("/attendance/summary", methods=["GET"])
@jwt_required()
def student_attendance_summary():
    claims = get_jwt()
    if not _is_student(claims):
        return jsonify({"error": "only students may view this summary"}), 403

    student = Student.query.filter_by(user_id=int(get_jwt_identity())).first()
    if not student:
        return jsonify({"error": "student profile not found"}), 404

    subjects = []
    overall_present = 0
    overall_total = 0

    for enrollment in student.student_courses:
        course = enrollment.course
        if not course:
            continue
        sessions = Session.query.filter_by(course_id=course.course_id).all()
        total = len(sessions)
        present = Attendance.query.join(Session).filter(
            Attendance.student_id == student.student_id,
            Attendance.status == "Present",
            Session.course_id == course.course_id,
        ).count() if sessions else 0
        attendance_percent = round((present / total) * 100.0, 2) if total else 0.0
        subjects.append({
            "subjectId": course.code,
            "subjectName": course.name,
            "attendance": attendance_percent,
            "present": present,
            "total": total,
            "teacher_name": course.teacher.name if course.teacher else None,
            "schedule_info": course.schedule_info,
            "section": course.section,
        })
        overall_present += present
        overall_total += total

    overall = {
        "present": overall_present,
        "total": overall_total,
        "attendance": round((overall_present / overall_total) * 100.0, 2) if overall_total else 0.0,
    }

    return jsonify({"subjects": subjects, "overall": overall})


@attendance_bp.route("/attendance/latest", methods=["GET"])
@jwt_required()
def student_attendance_latest():
    claims = get_jwt()
    if not _is_student(claims):
        return jsonify({"error": "only students may view their latest attendance"}), 403

    student = Student.query.filter_by(user_id=int(get_jwt_identity())).first()
    if not student:
        return jsonify({"error": "student profile not found"}), 404

    history = (
        Attendance.query
        .filter_by(student_id=student.student_id)
        .order_by(Attendance.timestamp.desc())
        .limit(20)
        .all()
    )

    items = []
    for att in history:
        items.append({
            "attendance_id": att.attendance_id,
            "session_id": att.session_id,
            "class_id": att.session.course_id if att.session else None,
            "class_name": att.session.course.name if att.session and att.session.course else None,
            "status": att.status,
            "method": att.method,
            "timestamp": att.timestamp.isoformat() if att.timestamp else None,
        })

    return jsonify({"items": items})


@attendance_bp.route("/attendance/class/<int:course_id>", methods=["GET"])
@jwt_required()
def get_class_attendance(course_id):
    sessions = Session.query.filter_by(course_id=course_id).order_by(Session.start_time.desc()).all()
    result = []
    for sess in sessions:
        atts = Attendance.query.filter_by(session_id=sess.session_id).all()
        result.append({
            "session_id":  sess.session_id,
            "start_time":  sess.start_time.isoformat() if sess.start_time else None,
            "active":      sess.active,
            "attendance":  [a.to_dict() for a in atts],
        })
    return jsonify({"course_id": course_id, "sessions": result})


# ══════════════════════════════════════════════════════════════
# Analytics
# ══════════════════════════════════════════════════════════════
@attendance_bp.route("/analytics/defaulters", methods=["GET"])
@jwt_required()
def get_defaulters():
    threshold = float(request.args.get("threshold", 75)) / 100.0

    sub = (
        db.session.query(
            Attendance.student_id,
            func.count(Attendance.attendance_id).label("tot"),
            func.sum(func.cast(Attendance.status == "Present", db.Integer)).label("pres"),
        )
        .group_by(Attendance.student_id)
        .subquery()
    )

    rows = (
        db.session.query(sub.c.student_id, sub.c.tot, sub.c.pres)
        .filter(sub.c.tot > 0)
        .filter((sub.c.pres * 1.0 / sub.c.tot) < threshold)
        .all()
    )

    out = []
    for row in rows:
        student = Student.query.get(row.student_id)
        pct = round((row.pres / row.tot) * 100.0, 2) if row.tot else 0.0
        out.append({
            "student_id":         row.student_id,
            "name":               student.name if student else None,
            "roll_no":            student.roll_no if student else None,
            "attendance_percent": pct,
            "present":            int(row.pres or 0),
            "total":              int(row.tot or 0),
        })

    return jsonify({"defaulters": out, "threshold_percent": threshold * 100})


@attendance_bp.route("/analytics/method-ratio", methods=["GET"])
@jwt_required()
def get_method_ratio():
    rows = (
        db.session.query(Attendance.method, func.count(Attendance.attendance_id))
        .group_by(Attendance.method)
        .all()
    )
    return jsonify({"method_stats": [{"method": r[0], "count": r[1]} for r in rows]})


@attendance_bp.route("/analytics/session/<int:session_id>/summary", methods=["GET"])
@jwt_required()
def session_summary(session_id):
    session = Session.query.get_or_404(session_id)
    enrolled = StudentCourse.query.filter_by(course_id=session.course_id).count()
    atts = Attendance.query.filter_by(session_id=session_id).all()
    present = sum(1 for a in atts if a.status == "Present")
    absent  = enrolled - present

    return jsonify({
        "session_id":   session_id,
        "course_id":    session.course_id,
        "enrolled":     enrolled,
        "present":      present,
        "absent":       absent,
        "percentage":   round((present / enrolled) * 100, 2) if enrolled else 0,
        "face_marked":  sum(1 for a in atts if a.method == "Face"),
        "manual_marked": sum(1 for a in atts if a.method == "Manual"),
    })
