import os
from dotenv import load_dotenv

load_dotenv()


def _env(key: str, default: str | None = None, required_in_production: bool = False) -> str:
    value = os.getenv(key)
    if value is None or value.strip() == "":
        if required_in_production and os.getenv("FLASK_ENV", "development").lower() == "production":
            raise RuntimeError(f"{key} must be set in production")
        return default or ""
    return value


class Config:
    # ── Security ──────────────────────────────────────────────
    SECRET_KEY = _env("SECRET_KEY", "change-me-in-production", required_in_production=True)
    JWT_SECRET_KEY = _env("JWT_SECRET_KEY", "change-me-in-production", required_in_production=True)
    JWT_ACCESS_TOKEN_EXPIRES_HOURS = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES_HOURS", 8))

    # ── Database ───────────────────────────────────────────────
    # Render injects DATABASE_URL; also support SQLALCHEMY_DATABASE_URI for compatibility.
    # Render uses postgres:// prefix, SQLAlchemy requires postgresql://
    _db_url = (
        os.getenv("DATABASE_URL")
        or os.getenv("SQLALCHEMY_DATABASE_URI")
    )
    if _db_url and _db_url.startswith("postgres://"):
        _db_url = _db_url.replace("postgres://", "postgresql://", 1)

    if not _db_url and os.getenv("FLASK_ENV", "development").lower() == "production":
        raise RuntimeError("DATABASE_URL or SQLALCHEMY_DATABASE_URI must be set in production")

    SQLALCHEMY_DATABASE_URI = _db_url or "sqlite:///attendify_dev.db"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,          # survive Render's idle DB restarts
        "pool_recycle": 280,            # recycle connections before 5-min timeout
        "pool_size": 5,
        "max_overflow": 10,
    }

    # ── FaceNet microservice ───────────────────────────────────
    FACE_SERVICE_URL = _env("FACE_SERVICE_URL", "http://127.0.0.1:5001", required_in_production=True)

    # ── Geofencing ─────────────────────────────────────────────
    GEOFENCE_RADIUS_METERS = float(os.getenv("GEOFENCE_RADIUS_METERS", 100))

    # ── Redis / cache / queue ───────────────────────────────────
    REDIS_URL = _env("REDIS_URL", "redis://localhost:6379/0", required_in_production=True)
    RATE_LIMIT = _env("RATE_LIMIT", "120 per minute")
    DEFAULT_CACHE_TTL = int(os.getenv("DEFAULT_CACHE_TTL", 60))
    USE_ASYNC_FACE_ENROLLMENT = os.getenv("USE_ASYNC_FACE_ENROLLMENT", "true").lower() in ("1", "true", "yes")

    # ── Session storage ────────────────────────────────────────
    SESSION_TYPE = "redis"
    SESSION_PERMANENT = False
    SESSION_USE_SIGNER = True

    # ── CORS ───────────────────────────────────────────────────
    # Comma-separated list of allowed origins
    CORS_ORIGINS = [
        o.strip()
        for o in _env("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
        if o.strip()
    ]
