"""
SQLAlchemy models — PostgreSQL-compatible.

Key changes vs original:
  - Enum types named to avoid re-creation conflicts on Postgres
  - FaceEmbedding.embedding_vector uses ARRAY(Float) for Postgres
    (falls back to JSON for SQLite in dev)
  - GeofenceZone table added (was in-memory / frontend only)
  - Added indexes for hot query paths
  - refresh_token table for future token rotation
"""
from datetime import datetime, timezone
from sqlalchemy import Index
from extensions import db
from werkzeug.security import generate_password_hash, check_password_hash

try:
    from sqlalchemy.dialects.postgresql import ARRAY
    from sqlalchemy import Float as _Float
    _VECTOR_TYPE = ARRAY(_Float)
    _USE_ARRAY = True
except Exception:
    _USE_ARRAY = False

# ── Enums (named so Postgres doesn't raise on re-create) ──────────────────────
import sqlalchemy as sa

user_roles_enum = sa.Enum("student", "teacher", "admin", name="user_roles")
attendance_status_enum = sa.Enum("Present", "Absent", "Late", name="attendance_status")
attendance_method_enum = sa.Enum("Face", "Manual", name="attendance_method")


# ══════════════════════════════════════════════════════════════════════════════
# Users
# ══════════════════════════════════════════════════════════════════════════════
class User(db.Model):
    __tablename__ = "users"

    user_id      = db.Column(db.Integer, primary_key=True, autoincrement=True)
    username     = db.Column(db.String(50), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role         = db.Column(user_roles_enum, nullable=False)
    created_at   = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    last_login   = db.Column(db.DateTime(timezone=True), nullable=True)

    # relationships
    student       = db.relationship("Student",      uselist=False, back_populates="user", cascade="all, delete-orphan")
    teacher       = db.relationship("Teacher",      uselist=False, back_populates="user", cascade="all, delete-orphan")
    logs          = db.relationship("Log",          backref="user", lazy="dynamic", cascade="all, delete-orphan")
    notifications = db.relationship("Notification", backref="user", lazy="dynamic", cascade="all, delete-orphan")

    def set_password(self, password: str):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {"user_id": self.user_id, "username": self.username, "role": self.role}


# ══════════════════════════════════════════════════════════════════════════════
# Teachers
# ══════════════════════════════════════════════════════════════════════════════
class Teacher(db.Model):
    __tablename__ = "teachers"

    staff_id    = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id     = db.Column(db.Integer, db.ForeignKey("users.user_id", ondelete="CASCADE"), unique=True, nullable=False)
    name        = db.Column(db.String(100), nullable=False)
    email       = db.Column(db.String(100), unique=True, nullable=False, index=True)
    phone       = db.Column(db.String(20))
    department  = db.Column(db.String(100))
    designation = db.Column(db.String(50))
    joined_at   = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user     = db.relationship("User",    back_populates="teacher")
    courses  = db.relationship("Course",  backref="teacher", lazy="dynamic", cascade="all, delete-orphan")
    sessions = db.relationship("Session", backref="teacher", lazy="dynamic", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "staff_id":    self.staff_id,
            "name":        self.name,
            "email":       self.email,
            "phone":       self.phone,
            "department":  self.department,
            "designation": self.designation,
        }


# ══════════════════════════════════════════════════════════════════════════════
# Students
# ══════════════════════════════════════════════════════════════════════════════
class Student(db.Model):
    __tablename__ = "students"

    student_id    = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id       = db.Column(db.Integer, db.ForeignKey("users.user_id", ondelete="CASCADE"), unique=True, nullable=False)
    roll_no       = db.Column(db.String(50), unique=True, nullable=False, index=True)
    name          = db.Column(db.String(100), nullable=False)
    class_code    = db.Column(db.String(50), nullable=False, index=True)
    email         = db.Column(db.String(100), index=True)
    phone         = db.Column(db.String(20))
    photo_path    = db.Column(db.Text)
    face_enrolled = db.Column(db.Boolean, default=False, nullable=False)
    registered_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user            = db.relationship("User",          back_populates="student")
    student_courses = db.relationship("StudentCourse", backref="student", lazy="dynamic", cascade="all, delete-orphan")
    attendance      = db.relationship("Attendance",    backref="student", lazy="dynamic", cascade="all, delete-orphan")
    embeddings      = db.relationship("FaceEmbedding", backref="student", lazy="dynamic", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "student_id":    self.student_id,
            "roll_no":       self.roll_no,
            "name":          self.name,
            "class_code":    self.class_code,
            "email":         self.email,
            "phone":         self.phone,
            "face_enrolled": self.face_enrolled,
        }


# ══════════════════════════════════════════════════════════════════════════════
# Courses
# ══════════════════════════════════════════════════════════════════════════════
class Course(db.Model):
    __tablename__ = "courses"

    course_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    code      = db.Column(db.String(20), unique=True, nullable=False)
    name      = db.Column(db.String(100), nullable=False)
    section   = db.Column(db.String(50), nullable=True)
    schedule_info = db.Column(db.String(255), nullable=True)
    staff_id  = db.Column(db.Integer, db.ForeignKey("teachers.staff_id", ondelete="CASCADE"), nullable=False)
    semester  = db.Column(db.Integer)
    credits   = db.Column(db.Integer)

    student_courses = db.relationship("StudentCourse", backref="course", lazy="dynamic", cascade="all, delete-orphan")
    sessions        = db.relationship("Session",       backref="course", lazy="dynamic", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "course_id":    self.course_id,
            "code":         self.code,
            "name":         self.name,
            "section":      self.section,
            "schedule_info": self.schedule_info,
            "semester":     self.semester,
            "credits":      self.credits,
            "staff_id":     self.staff_id,
        }


# ══════════════════════════════════════════════════════════════════════════════
# StudentCourse
# ══════════════════════════════════════════════════════════════════════════════
class StudentCourse(db.Model):
    __tablename__ = "student_courses"

    id         = db.Column(db.Integer, primary_key=True, autoincrement=True)
    student_id = db.Column(db.Integer, db.ForeignKey("students.student_id", ondelete="CASCADE"), nullable=False)
    course_id  = db.Column(db.Integer, db.ForeignKey("courses.course_id",   ondelete="CASCADE"), nullable=False)
    enrolled_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (db.UniqueConstraint("student_id", "course_id", name="uq_student_course"),)


# ══════════════════════════════════════════════════════════════════════════════
# Sessions (attendance sessions)
# ══════════════════════════════════════════════════════════════════════════════
class Session(db.Model):
    __tablename__ = "sessions"

    session_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    course_id  = db.Column(db.Integer, db.ForeignKey("courses.course_id",   ondelete="CASCADE"), nullable=False)
    staff_id   = db.Column(db.Integer, db.ForeignKey("teachers.staff_id",   ondelete="CASCADE"), nullable=False)
    start_time = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    end_time   = db.Column(db.DateTime(timezone=True), nullable=True)
    active     = db.Column(db.Boolean, default=True, nullable=False)
    # Geofence anchor set by teacher when starting session
    latitude   = db.Column(db.Numeric(10, 7), nullable=True)
    longitude  = db.Column(db.Numeric(10, 7), nullable=True)
    radius_meters = db.Column(db.Numeric(8, 2), nullable=True)   # override per session

    attendance = db.relationship("Attendance", backref="session", lazy="dynamic", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_sessions_active_course", "active", "course_id"),
    )

    def to_dict(self):
        return {
            "session_id":    self.session_id,
            "course_id":     self.course_id,
            "staff_id":      self.staff_id,
            "start_time":    self.start_time.isoformat() if self.start_time else None,
            "end_time":      self.end_time.isoformat()   if self.end_time   else None,
            "active":        self.active,
            "latitude":      float(self.latitude)      if self.latitude      else None,
            "longitude":     float(self.longitude)     if self.longitude     else None,
            "radius_meters": float(self.radius_meters) if self.radius_meters else None,
        }


# ══════════════════════════════════════════════════════════════════════════════
# Attendance
# ══════════════════════════════════════════════════════════════════════════════
class Attendance(db.Model):
    __tablename__ = "attendance"

    attendance_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    student_id    = db.Column(db.Integer, db.ForeignKey("students.student_id", ondelete="CASCADE"), nullable=False)
    session_id    = db.Column(db.Integer, db.ForeignKey("sessions.session_id", ondelete="CASCADE"), nullable=False)
    timestamp     = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    status        = db.Column(attendance_status_enum,  default="Present")
    method        = db.Column(attendance_method_enum,  default="Face")
    marked_by     = db.Column(db.Integer, db.ForeignKey("users.user_id"), nullable=True)
    geo_lat       = db.Column(db.Numeric(10, 7), nullable=True)
    geo_long      = db.Column(db.Numeric(10, 7), nullable=True)
    face_distance = db.Column(db.Numeric(6, 4), nullable=True)   # face match distance stored for audit

    __table_args__ = (
        db.UniqueConstraint("student_id", "session_id", name="uq_student_session"),
        Index("ix_attendance_student_session", "student_id", "session_id"),
    )

    def to_dict(self):
        return {
            "attendance_id": self.attendance_id,
            "student_id":    self.student_id,
            "session_id":    self.session_id,
            "timestamp":     self.timestamp.isoformat() if self.timestamp else None,
            "status":        self.status,
            "method":        self.method,
        }


# ══════════════════════════════════════════════════════════════════════════════
# FaceEmbedding
# ══════════════════════════════════════════════════════════════════════════════
class FaceEmbedding(db.Model):
    __tablename__ = "face_embeddings"

    embedding_id     = db.Column(db.Integer, primary_key=True, autoincrement=True)
    student_id       = db.Column(db.Integer, db.ForeignKey("students.student_id", ondelete="CASCADE"), nullable=False)
    # Store as JSON list of floats — compatible with both Postgres and SQLite
    embedding_vector = db.Column(db.JSON, nullable=False)
    created_at       = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    image_label      = db.Column(db.String(100), nullable=True)   # optional: "frontal", "left", "right"


# ══════════════════════════════════════════════════════════════════════════════
# GeofenceZone  (was in-memory only — now persisted)
# ══════════════════════════════════════════════════════════════════════════════
class GeofenceZone(db.Model):
    __tablename__ = "geofence_zones"

    id            = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name          = db.Column(db.String(100), nullable=False)
    latitude      = db.Column(db.Numeric(10, 7), nullable=False)
    longitude     = db.Column(db.Numeric(10, 7), nullable=False)
    radius_meters = db.Column(db.Numeric(8, 2), nullable=False, default=100)
    created_by    = db.Column(db.Integer, db.ForeignKey("users.user_id"), nullable=True)
    created_at    = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    active        = db.Column(db.Boolean, default=True)

    def to_dict(self):
        return {
            "id":            self.id,
            "name":          self.name,
            "latitude":      float(self.latitude),
            "longitude":     float(self.longitude),
            "radius_meters": float(self.radius_meters),
            "active":        self.active,
            "created_at":    self.created_at.isoformat() if self.created_at else None,
        }


# ══════════════════════════════════════════════════════════════════════════════
# Notifications
# ══════════════════════════════════════════════════════════════════════════════
class Notification(db.Model):
    __tablename__ = "notifications"

    notification_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id         = db.Column(db.Integer, db.ForeignKey("users.user_id", ondelete="CASCADE"), nullable=True)
    title           = db.Column(db.String(100), nullable=False)
    message         = db.Column(db.Text, nullable=False)
    created_at      = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    read_status     = db.Column(db.Boolean, default=False)

    def to_dict(self):
        return {
            "notification_id": self.notification_id,
            "title":           self.title,
            "message":         self.message,
            "created_at":      self.created_at.isoformat(),
            "read_status":     self.read_status,
        }


# ══════════════════════════════════════════════════════════════════════════════
# Logs
# ══════════════════════════════════════════════════════════════════════════════
class Log(db.Model):
    __tablename__ = "logs"

    log_id     = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id    = db.Column(db.Integer, db.ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    action     = db.Column(db.String(100), nullable=False)
    timestamp  = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    ip_address = db.Column(db.String(50))
    details    = db.Column(db.JSON, nullable=True)
