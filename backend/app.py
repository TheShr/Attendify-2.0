import datetime
import logging
import time
from flask import Flask, jsonify, request
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from werkzeug.exceptions import HTTPException
from config import Config
from extensions import db, limiter, session_store, compress
from redis_client import redis_client

jwt = JWTManager()


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = datetime.timedelta(
        hours=Config.JWT_ACCESS_TOKEN_EXPIRES_HOURS
    )
    app.config["RATELIMIT_STORAGE_URI"] = Config.REDIS_URL
    app.config["RATELIMIT_DEFAULT"] = Config.RATE_LIMIT
    app.config["SESSION_REDIS"] = redis_client
    app.config["SESSION_TYPE"] = "redis"
    app.config["SESSION_PERMANENT"] = False
    app.config["SESSION_USE_SIGNER"] = True
    # Flask-Session 0.4.0 is not fully compatible with Flask 3.x.
    # Add the legacy attribute it still expects.
    app.session_cookie_name = app.config.get("SESSION_COOKIE_NAME", "session")

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    db.init_app(app)
    jwt.init_app(app)
    limiter.init_app(app)
    session_store.init_app(app)
    compress.init_app(app)

    # ── CORS: allow configured origins for all /api/* routes ──
    CORS(
        app,
        resources={r"/api/*": {"origins": Config.CORS_ORIGINS}},
        supports_credentials=True,
    )

    @app.before_request
    def start_timer():
        request.start_time = time.monotonic()

    @app.after_request
    def add_response_headers(response):
        elapsed = int((time.monotonic() - getattr(request, "start_time", time.monotonic())) * 1000)
        response.headers["X-Response-Time-ms"] = str(elapsed)
        response.headers.setdefault("Cache-Control", "public, max-age=30, stale-while-revalidate=30")
        response.headers.setdefault("Vary", "Accept-Encoding, Authorization")
        return response

    @app.errorhandler(Exception)
    def handle_exception(error):
        if isinstance(error, HTTPException):
            return error
        app.logger.exception("Unhandled request exception")
        return jsonify({"error": "internal_server_error"}), 500

    # ── Blueprints ────────────────────────────────────────────
    from auth_routes import auth_bp
    from attendance_routes import attendance_bp
    from teacher_routes import teacher_bp
    from student_routes import student_bp
    from geofence_routes import geofence_bp
    from admin_routes import admin_bp

    app.register_blueprint(auth_bp,        url_prefix="/api/auth")
    app.register_blueprint(attendance_bp,  url_prefix="/api")
    app.register_blueprint(teacher_bp,     url_prefix="/api/teacher")
    app.register_blueprint(student_bp,     url_prefix="/api/student")
    app.register_blueprint(geofence_bp,    url_prefix="/api/geofences")
    app.register_blueprint(admin_bp,       url_prefix="/api/admin")

    # ── Health check ──────────────────────────────────────────
    @app.route("/api/health")
    def health():
        return jsonify({"status": "ok", "service": "attendify-backend"})

    # ── JWT error handlers ────────────────────────────────────
    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return jsonify({"error": "token_expired", "message": "Token has expired"}), 401

    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        return jsonify({"error": "invalid_token", "message": str(error)}), 422

    @jwt.unauthorized_loader
    def missing_token_callback(error):
        return jsonify({"error": "authorization_required", "message": str(error)}), 401

    # ── Auto-create tables on first run ───────────────────────
    with app.app_context():
        db.create_all()

    return app


app = create_app()

if __name__ == "__main__":
    import os
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
