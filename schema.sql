-- =============================================================
-- Attendify PostgreSQL Schema
-- Run this once on a fresh database, OR let SQLAlchemy's
-- db.create_all() handle it (preferred for Render deployment).
-- =============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Enums ──────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE user_roles          AS ENUM ('student', 'teacher', 'admin');
  CREATE TYPE attendance_status   AS ENUM ('Present', 'Absent', 'Late');
  CREATE TYPE attendance_method   AS ENUM ('Face', 'Manual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── users ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    user_id       SERIAL PRIMARY KEY,
    username      VARCHAR(50)  UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role          user_roles   NOT NULL,
    created_at    TIMESTAMPTZ  DEFAULT NOW(),
    last_login    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_users_username ON users(username);

-- ── teachers ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teachers (
    staff_id    SERIAL PRIMARY KEY,
    user_id     INTEGER UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(100) UNIQUE NOT NULL,
    phone       VARCHAR(20),
    department  VARCHAR(100),
    designation VARCHAR(50),
    joined_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_teachers_email ON teachers(email);

-- ── students ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS students (
    student_id    SERIAL PRIMARY KEY,
    user_id       INTEGER UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    roll_no       VARCHAR(50) UNIQUE NOT NULL,
    name          VARCHAR(100) NOT NULL,
    class_code    VARCHAR(50)  NOT NULL,
    email         VARCHAR(100),
    phone         VARCHAR(20),
    photo_path    TEXT,
    face_enrolled BOOLEAN NOT NULL DEFAULT FALSE,
    registered_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_students_roll_no    ON students(roll_no);
CREATE INDEX IF NOT EXISTS ix_students_class_code ON students(class_code);
CREATE INDEX IF NOT EXISTS ix_students_email      ON students(email);

-- ── courses ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS courses (
    course_id SERIAL PRIMARY KEY,
    code      VARCHAR(20)  UNIQUE NOT NULL,
    name      VARCHAR(100) NOT NULL,
    section   VARCHAR(50),
    schedule_info VARCHAR(255),
    staff_id  INTEGER NOT NULL REFERENCES teachers(staff_id) ON DELETE CASCADE,
    semester  INTEGER,
    credits   INTEGER
);

-- ── student_courses ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_courses (
    id          SERIAL PRIMARY KEY,
    student_id  INTEGER NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    course_id   INTEGER NOT NULL REFERENCES courses(course_id)   ON DELETE CASCADE,
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_student_course UNIQUE (student_id, course_id)
);

-- ── sessions (attendance sessions) ───────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
    session_id    SERIAL PRIMARY KEY,
    course_id     INTEGER NOT NULL REFERENCES courses(course_id)   ON DELETE CASCADE,
    staff_id      INTEGER NOT NULL REFERENCES teachers(staff_id)   ON DELETE CASCADE,
    start_time    TIMESTAMPTZ DEFAULT NOW(),
    end_time      TIMESTAMPTZ,
    active        BOOLEAN NOT NULL DEFAULT TRUE,
    latitude      NUMERIC(10, 7),
    longitude     NUMERIC(10, 7),
    radius_meters NUMERIC(8, 2) DEFAULT 100
);
CREATE INDEX IF NOT EXISTS ix_sessions_active_course ON sessions(active, course_id);

-- ── attendance ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance (
    attendance_id SERIAL PRIMARY KEY,
    student_id    INTEGER NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    session_id    INTEGER NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    timestamp     TIMESTAMPTZ DEFAULT NOW(),
    status        attendance_status NOT NULL DEFAULT 'Present',
    method        attendance_method NOT NULL DEFAULT 'Face',
    marked_by     INTEGER REFERENCES users(user_id),
    geo_lat       NUMERIC(10, 7),
    geo_long      NUMERIC(10, 7),
    face_distance NUMERIC(6, 4),
    CONSTRAINT uq_student_session UNIQUE (student_id, session_id)
);
CREATE INDEX IF NOT EXISTS ix_attendance_student_session ON attendance(student_id, session_id);
CREATE INDEX IF NOT EXISTS ix_attendance_session_id      ON attendance(session_id);
CREATE INDEX IF NOT EXISTS ix_attendance_student_id      ON attendance(student_id);

-- ── face_embeddings ───────────────────────────────────────────
-- Stores the embedding vector as JSONB (list of floats).
-- If you add pgvector later: ALTER TABLE face_embeddings ADD COLUMN embedding_vec vector(512);
CREATE TABLE IF NOT EXISTS face_embeddings (
    embedding_id     SERIAL PRIMARY KEY,
    student_id       INTEGER NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    embedding_vector JSONB   NOT NULL,
    image_label      VARCHAR(100),
    created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_face_embeddings_student ON face_embeddings(student_id);

-- ── geofence_zones ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS geofence_zones (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    latitude      NUMERIC(10, 7) NOT NULL,
    longitude     NUMERIC(10, 7) NOT NULL,
    radius_meters NUMERIC(8, 2)  NOT NULL DEFAULT 100,
    created_by    INTEGER REFERENCES users(user_id),
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    active        BOOLEAN DEFAULT TRUE
);

-- ── notifications ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
    notification_id SERIAL PRIMARY KEY,
    user_id         INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    title           VARCHAR(100) NOT NULL,
    message         TEXT         NOT NULL,
    created_at      TIMESTAMPTZ  DEFAULT NOW(),
    read_status     BOOLEAN      DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS ix_notifications_user ON notifications(user_id, read_status);

-- ── logs ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS logs (
    log_id     SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    action     VARCHAR(100) NOT NULL,
    timestamp  TIMESTAMPTZ  DEFAULT NOW(),
    ip_address VARCHAR(50),
    details    JSONB
);
CREATE INDEX IF NOT EXISTS ix_logs_timestamp ON logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS ix_logs_user_id   ON logs(user_id);

-- =============================================================
-- Helpful views
-- =============================================================

-- Attendance percentage per student per course
CREATE OR REPLACE VIEW v_student_course_attendance AS
SELECT
    s.student_id,
    s.name         AS student_name,
    s.roll_no,
    c.course_id,
    c.name         AS course_name,
    c.code         AS course_code,
    COUNT(sess.session_id)                                        AS total_sessions,
    COUNT(a.attendance_id) FILTER (WHERE a.status = 'Present')   AS present,
    ROUND(
        100.0 * COUNT(a.attendance_id) FILTER (WHERE a.status = 'Present')
        / NULLIF(COUNT(sess.session_id), 0),
        2
    )                                                             AS attendance_pct
FROM students s
JOIN student_courses sc  ON sc.student_id = s.student_id
JOIN courses c           ON c.course_id   = sc.course_id
LEFT JOIN sessions sess  ON sess.course_id = c.course_id
LEFT JOIN attendance a   ON a.session_id  = sess.session_id
                        AND a.student_id  = s.student_id
GROUP BY s.student_id, s.name, s.roll_no, c.course_id, c.name, c.code;

-- Defaulters (< 75%)
CREATE OR REPLACE VIEW v_defaulters AS
SELECT * FROM v_student_course_attendance
WHERE attendance_pct < 75 OR attendance_pct IS NULL;
