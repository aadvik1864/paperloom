import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY")
    
    # Database
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL")
    if SQLALCHEMY_DATABASE_URI and SQLALCHEMY_DATABASE_URI.startswith("postgres://"):
        SQLALCHEMY_DATABASE_URI = SQLALCHEMY_DATABASE_URI.replace("postgres://", "postgresql://", 1)
    if not SQLALCHEMY_DATABASE_URI:
        SQLALCHEMY_DATABASE_URI = "sqlite:///dev.db"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # JWT
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=1)
    ADMIN_PROFILE_NAME = os.getenv("ADMIN_PROFILE_NAME", "Administrator")
    ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")
    MAX_CONTENT_LENGTH = 21 * 1024 * 1024
    MAX_FILE_BYTES = 20 * 1024 * 1024
    MAX_AVATAR_BYTES = 5 * 1024 * 1024
    RATELIMIT_STORAGE_URI = os.getenv("RATELIMIT_STORAGE_URI", "memory://")
    RATELIMIT_STRATEGY = "moving-window"
    RATELIMIT_HEADERS_ENABLED = True
    RATELIMIT_KEY_PREFIX = "paperloom"
    CORS_ORIGINS = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:5184").split(",") if origin.strip()]
    PROXY_HOPS = int(os.getenv("PROXY_HOPS", "0"))
    ENVIRONMENT = os.getenv("FLASK_ENV", "production")
    
    # Cloudflare R2 / S3
    R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME")
    R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID")
    R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID")
    R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
    R2_PUBLIC_URL = os.getenv("R2_PUBLIC_URL", "")  # Optional direct URL CDN
    
    # Server configuration
    PORT = int(os.getenv("PORT", 5000))
    DEBUG = os.getenv("FLASK_ENV") == "development"
