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
    
    # CLI commands
    @app.cli.command("seed")
    def seed_command():
        """Seed database with admin user and categories."""
        from database.seed import seed_database
        with app.app_context():
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
