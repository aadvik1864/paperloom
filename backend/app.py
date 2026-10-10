import hmac
import click
from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.exceptions import HTTPException
from werkzeug.middleware.proxy_fix import ProxyFix
from extensions import db, jwt, limiter
from config import Config
from services.r2_storage import r2_storage


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(Config)
    app.config.from_object(config_class)
    for key in ("SECRET_KEY", "JWT_SECRET_KEY"):
        secret = app.config.get(key)
        if not isinstance(secret, str) or len(secret) < 32 or secret.lower().startswith(("change-this", "your-", "super-secret", "jwt-secret")):
            raise ValueError(f"{key} must be explicitly configured with at least 32 random characters.")
    if app.config.get("ENVIRONMENT") == "production" and not app.testing:
        uri = app.config["RATELIMIT_STORAGE_URI"]
        if not uri.startswith(("redis://", "rediss://")):
            raise ValueError("Production requires a shared Redis RATELIMIT_STORAGE_URI.")
        origins = app.config["CORS_ORIGINS"]
        if not origins or any(not origin.startswith("https://") or "*" in origin for origin in origins):
            raise ValueError("Production requires explicit HTTPS frontend CORS_ORIGINS.")
    hops = app.config.get("PROXY_HOPS", 0)
    if hops:
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=hops, x_proto=hops)

    db.init_app(app)
    jwt.init_app(app)
    limiter.init_app(app)
    r2_storage.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})

    import models  # noqa: F401
    from models.user import User
    from utils.security import auth_version
    with app.app_context():
        db.create_all()
        from database.seed import seed_database
        seed_database()

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
        return jsonify({"status": "healthy", "service": "paperloom"})

    @jwt.token_in_blocklist_loader
    def invalid_session(jwt_header, payload):
        try:
            user = db.session.get(User, int(payload.get("sub", "")))
        except (TypeError, ValueError):
            return True
        stamp = payload.get("auth_version")
        return not user or not isinstance(stamp, str) or not hmac.compare_digest(stamp, auth_version(user))

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

    @app.after_request
    def security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        if request.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        if request.is_secure:
            response.headers["Strict-Transport-Security"] = "max-age=31536000"
        return response

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=app.config["PORT"], debug=app.config["DEBUG"])
