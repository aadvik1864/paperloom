import os
import click
from flask import Flask, jsonify
from flask_cors import CORS
from extensions import db, jwt
from config import Config
from services.r2_storage import r2_storage

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    # Initialize extensions
    db.init_app(app)
    jwt.init_app(app)
    r2_storage.init_app(app)
    
    # Enable CORS
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    
    # Import models so db.create_all() works
    import models  # noqa: F401
    
    # Auto-create tables and seed data on startup
    with app.app_context():
        db.create_all()
        from database.seed import seed_database
        seed_database()
    
    # CLI commands
    @app.cli.command("seed")
    def seed_command():
        """Seed database with admin user and categories."""
        from database.seed import seed_database
        with app.app_context():
            db.create_all()
            seed_database()
    
    # Register blueprints
    from routes.auth import auth_bp
    from routes.papers import papers_bp
    from routes.blogs import blogs_bp
    from routes.users import users_bp
    from routes.admin import admin_bp
    
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(papers_bp, url_prefix="/api/papers")
    app.register_blueprint(blogs_bp, url_prefix="/api/blogs")
    app.register_blueprint(users_bp, url_prefix="/api/users")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")
    
    @app.route("/health")
    def health_check():
        return jsonify({"status": "healthy", "service": "al-qwal-publications"}), 200

    @app.route("/debug/config")
    def debug_config():
        jsk = app.config.get("JWT_SECRET_KEY", "NOT SET")
        sk = app.config.get("SECRET_KEY", "NOT SET")
        jalg = app.config.get("JWT_ALGORITHM", "NOT SET")
        idec = app.config.get("JWT_DECODE_ALGORITHMS", "NOT SET")
        return jsonify({
            "JWT_SECRET_KEY_PREFIX": jsk[:10] + "..." if len(jsk) > 10 else jsk,
            "JWT_SECRET_KEY_LEN": len(jsk) if jsk else 0,
            "SECRET_KEY_PREFIX": sk[:10] + "..." if len(sk) > 10 else sk,
            "JWT_ALGORITHM": str(jalg),
            "JWT_DECODE_ALGORITHMS": str(idec),
            "FLASK_ENV": os.environ.get("FLASK_ENV", "NOT SET"),
            "DATABASE_URL_PREFIX": (app.config.get("SQLALCHEMY_DATABASE_URI", "")[:30] + "...") if app.config.get("SQLALCHEMY_DATABASE_URI") else "NOT SET",
        })

    @app.route("/debug/verify", methods=["POST"])
    def debug_verify():
        from flask_jwt_extended import decode_token
        from flask import request
        data = request.get_json() or {}
        token = data.get("token", "")
        try:
            decoded = decode_token(token)
            return jsonify({"valid": True, "sub": decoded.get("sub")}), 200
        except Exception as e:
            return jsonify({"valid": False, "error": str(e)}), 401
        
    @jwt.unauthorized_loader
    def unauthorized_response(callback):
        return jsonify({"message": "Missing or invalid authorization header"}), 401
        
    @jwt.expired_token_loader
    def expired_token_response(jwt_header, jwt_payload):
        return jsonify({"message": "Token has expired"}), 401
        
    @jwt.invalid_token_loader
    def invalid_token_response(callback):
        return jsonify({"message": "Signature verification failed"}), 401
        
    return app

if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=app.config["PORT"], debug=app.config["DEBUG"])
