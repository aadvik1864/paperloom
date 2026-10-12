import hmac
import logging
from pathlib import Path
from urllib.parse import urlsplit
import click
from flask import Flask, abort, jsonify, request, send_from_directory
from flask_cors import CORS
from flask_jwt_extended.exceptions import CSRFError
from redis import Redis
from redis.exceptions import RedisError
from sqlalchemy import inspect, text
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.exceptions import HTTPException
from werkzeug.middleware.proxy_fix import ProxyFix
from werkzeug.utils import safe_join
from extensions import db, jwt, limiter
from config import Config
from services.r2_storage import r2_storage
from services.sessions import SessionStore, SessionStoreUnavailable, session_store


def create_app(config_class=Config):
    app = Flask(__name__, static_folder=None)
    app.logger.setLevel(logging.INFO)
    app.config.from_object(Config)
    app.config.from_object(config_class)
    if app.config.get("ENVIRONMENT") == "production" and not app.testing:
        app.config["JWT_COOKIE_SECURE"] = True
        app.config["JWT_ACCESS_COOKIE_NAME"] = "__Host-paperloom_access"
        app.config["JWT_ACCESS_CSRF_COOKIE_NAME"] = "__Host-paperloom_csrf"
    for key in ("SECRET_KEY", "JWT_SECRET_KEY"):
        secret = app.config.get(key)
        if (not isinstance(secret, str) or len(secret) < 32 or len(set(secret)) < 8 or
                secret.lower().startswith(("change-this", "your-", "super-secret", "jwt-secret", "generate-", "replace-", "example-"))):
            raise ValueError(f"{key} must be explicitly configured with at least 32 random characters.")
    if app.config["SECRET_KEY"] == app.config["JWT_SECRET_KEY"]:
        raise ValueError("SECRET_KEY and JWT_SECRET_KEY must be different values.")
    if app.config.get("ENVIRONMENT") == "production" and not app.testing:
        if not app.config.get("SQLALCHEMY_DATABASE_URI", "").startswith("postgresql+"):
            raise ValueError("Production requires a PostgreSQL DATABASE_URL.")
        uri = app.config["RATELIMIT_STORAGE_URI"]
        try:
            redis_url = urlsplit(uri)
            valid_redis = redis_url.scheme in {"redis", "rediss"} and redis_url.hostname and not redis_url.fragment
            redis_url.port
        except (TypeError, ValueError):
            valid_redis = False
        if not valid_redis:
            raise ValueError("Production requires a shared Redis RATELIMIT_STORAGE_URI.")
        origins = app.config["CORS_ORIGINS"]
        if not origins:
            raise ValueError("Production requires explicit HTTPS frontend CORS_ORIGINS.")
        for origin in origins:
            try:
                parsed_origin = urlsplit(origin)
                valid_origin = (parsed_origin.scheme == "https" and parsed_origin.hostname and
                                not parsed_origin.username and not parsed_origin.password and
                                parsed_origin.path in {"", "/"} and not parsed_origin.query and
                                not parsed_origin.fragment and "*" not in origin)
                parsed_origin.port
            except ValueError:
                valid_origin = False
            if not valid_origin:
                raise ValueError("CORS_ORIGINS must contain exact HTTPS origins only (no paths or wildcards).")
    hops = app.config.get("PROXY_HOPS", 0)
    if hops:
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=hops, x_proto=hops)

    db.init_app(app)
    jwt.init_app(app)
    limiter.init_app(app)
    app.extensions["paperloom_sessions"] = SessionStore(app.config["RATELIMIT_STORAGE_URI"])
    if app.config.get("ENVIRONMENT") == "production" and not app.testing:
        redis_client = Redis.from_url(
            app.config["RATELIMIT_STORAGE_URI"],
            socket_connect_timeout=3,
            socket_timeout=3,
        )
        try:
            redis_client.ping()
        except Exception:
            raise RuntimeError("The configured Redis service is unreachable; verify RATELIMIT_STORAGE_URI and network access.") from None
        finally:
            redis_client.close()
    r2_storage.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})

    import models  # noqa: F401
    from models.user import User
    from utils.security import auth_version
    with app.app_context():
        if app.config.get("ENVIRONMENT") != "production" or app.testing:
            db.create_all()
            from database.seed import seed_database
            seed_database()
        else:
            try:
                schema = inspect(db.engine)
                for table in db.metadata.sorted_tables:
                    if not schema.has_table(table.name) or not set(table.columns.keys()).issubset(
                            {column["name"] for column in schema.get_columns(table.name)}):
                        raise RuntimeError("Database schema is not ready. Apply the reviewed database migrations before starting.")
            except SQLAlchemyError:
                raise RuntimeError("Database is unreachable; verify database configuration and network access.") from None

    @app.before_request
    def protect_cookie_origin():
        if not request.path.startswith("/api/") or request.method == "OPTIONS":
            return
        cookie_mode = request.headers.get("X-Paperloom-Session") == "cookie"
        if not cookie_mode and app.config["JWT_ACCESS_COOKIE_NAME"] not in request.cookies:
            return
        # CORS alone does not prevent cross-site writes or login CSRF.
        origin = request.headers.get("Origin")
        if (origin and origin != request.host_url.rstrip("/")) or request.headers.get("Sec-Fetch-Site") == "cross-site":
            abort(403, description="Use the main website to access your session.")

    @app.before_request
    def validate_numeric_inputs():
        from utils.security import MAX_ID
        for value in (request.view_args or {}).values():
            if isinstance(value, int) and not 1 <= value <= MAX_ID:
                abort(404)
        if not request.path.startswith("/api/"):
            return
        for key, maximum in (("page", 1000000), ("per_page", 1000), ("author_id", MAX_ID), ("category_id", MAX_ID)):
            if key not in request.args:
                continue
            values = request.args.getlist(key)
            try:
                valid = len(values) == 1 and 1 <= int(values[0]) <= maximum
            except (ValueError, TypeError):
                valid = False
            if not valid:
                abort(400, description=f"{key} must be a positive integer no greater than {maximum}.")

    @app.cli.command("seed")
    def seed_command():
        """Create categories and an explicitly configured initial admin."""
        from database.seed import seed_database
        seed_database()

    @app.cli.command("bootstrap-admin")
    @click.option("--profile", default="Administrator", help="Admin profile to create or securely reset.")
    def bootstrap_admin(profile):
        """Create/reset an administrator without putting a password in shell history."""
        profile = " ".join(profile.split())
        if not profile or len(profile) > 150 or any(ord(char) < 32 for char in profile):
            raise click.ClickException("Choose a profile name of 1–150 characters.")
        password = click.prompt("New admin password (12+ characters)", hide_input=True, confirmation_prompt=True)
        user = User.query.filter_by(profile_name=profile).first()
        if user and user.role != "admin":
            raise click.ClickException("That profile belongs to a non-admin. Choose another name.")
        user = user or User(profile_name=profile, role="admin")
        try:
            user.set_password(password)
        except ValueError as error:
            raise click.ClickException(str(error)) from error
        db.session.add(user)
        db.session.commit()
        from services.audit import audit_event
        audit_event("bootstrap_admin", "user", user.id)
        click.echo("Administrator saved. Previous sessions are invalidated.")

    from routes.auth import auth_bp
    from routes.papers import papers_bp
    from routes.blogs import blogs_bp
    from routes.users import users_bp
    from routes.admin import admin_bp
    for blueprint, prefix in ((auth_bp, "auth"), (papers_bp, "papers"), (blogs_bp, "blogs"), (users_bp, "users"), (admin_bp, "admin")):
        app.register_blueprint(blueprint, url_prefix=f"/api/{prefix}")

    @app.route("/health")
    @limiter.exempt
    def health_check():
        try:
            db.session.execute(text("SELECT 1"))
            if app.config["RATELIMIT_STORAGE_URI"].startswith(("redis://", "rediss://")):
                with Redis.from_url(app.config["RATELIMIT_STORAGE_URI"], socket_connect_timeout=3, socket_timeout=3) as redis_client:
                    if not redis_client.ping():
                        raise RuntimeError("Redis unavailable")
        except Exception:
            db.session.rollback()
            return jsonify({"status": "unavailable", "service": "paperloom"}), 503
        return jsonify({"status": "healthy", "service": "paperloom"})

    @app.route("/live")
    @limiter.exempt
    def liveness_check():
        return jsonify({"status": "alive", "service": "paperloom"})

    @app.route("/version")
    @limiter.exempt
    def version():
        import re
        revision = app.config.get("APP_REVISION", "unknown")
        if not isinstance(revision, str) or not re.fullmatch(r"[0-9a-f]{40}", revision):
            revision = "unknown"
        return jsonify({"service": "paperloom", "revision": revision})

    frontend_dir = Path(app.config.get("FRONTEND_DIST", Path(app.root_path) / "frontend_dist"))
    if (frontend_dir / "index.html").is_file():
        @app.route("/", defaults={"path": ""})
        @app.route("/<path:path>")
        @limiter.exempt
        def frontend(path):
            if path == "api" or path.startswith("api/"):
                abort(404)
            if any(part.startswith(".") for part in Path(path).parts):
                abort(404)
            file_path = safe_join(str(frontend_dir), path)
            if file_path is None:
                abort(404)
            if path and Path(file_path).is_file():
                return send_from_directory(frontend_dir, path)
            if path.startswith("assets/") or Path(path).suffix:
                abort(404)
            return send_from_directory(frontend_dir, "index.html")

    @jwt.token_in_blocklist_loader
    def invalid_session(jwt_header, payload):
        try:
            from utils.security import MAX_ID
            identity = int(payload.get("sub", ""))
            if not 1 <= identity <= MAX_ID:
                return True
            user = db.session.get(User, identity)
        except (TypeError, ValueError):
            return True
        stamp = payload.get("auth_version")
        return (not user or not isinstance(stamp, str) or not hmac.compare_digest(stamp, auth_version(user))
                or not session_store().active(payload))

    @jwt.revoked_token_loader
    def revoked_response(jwt_header, payload):
        return jsonify({"message": "Your session changed. Sign in again."}), 401

    @jwt.unauthorized_loader
    def unauthorized_response(reason):
        return jsonify({"message": "Sign in to continue."}), 401

    @jwt.expired_token_loader
    def expired_response(jwt_header, payload):
        return jsonify({"message": "Your session expired. Sign in again."}), 401

    @jwt.invalid_token_loader
    def invalid_response(reason):
        return jsonify({"message": "Invalid session. Sign in again."}), 401

    @app.errorhandler(HTTPException)
    def http_error(error):
        response = jsonify({"message": error.description})
        response.status_code = error.code
        if error.code == 429:
            response.headers["Retry-After"] = "60"
        return response

    @app.errorhandler(CSRFError)
    def csrf_error(error):
        return jsonify({"message": "Session verification failed. Reload the page and try again."}), 403

    @app.errorhandler(SQLAlchemyError)
    def database_error(error):
        db.session.rollback()
        app.logger.error("Database operation failed (%s).", type(error).__name__)
        return jsonify({"message": "The database is temporarily unavailable. Try again."}), 503

    @app.errorhandler(RedisError)
    @app.errorhandler(SessionStoreUnavailable)
    def session_store_error(error):
        db.session.rollback()
        return jsonify({"message": "The session service is temporarily unavailable. Try again."}), 503

    @app.errorhandler(Exception)
    def unexpected_error(error):
        db.session.rollback()
        app.logger.error("Request failed (%s).", type(error).__name__)
        return jsonify({"message": "The request could not be completed. Try again."}), 500

    @app.after_request
    def security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; "
            "worker-src 'self' blob:; object-src 'none'; frame-src 'none'; "
            "frame-ancestors 'self'; base-uri 'self'; form-action 'self'"
        )
        if request.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        if request.path in {"/health", "/live", "/version"} or response.mimetype == "text/html":
            response.headers["Cache-Control"] = "no-store"
        if request.is_secure:
            response.headers["Strict-Transport-Security"] = "max-age=31536000"
        return response

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=app.config["PORT"], debug=app.config["DEBUG"])
