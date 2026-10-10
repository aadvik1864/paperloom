import hashlib
import hmac
from urllib.parse import urlsplit
from flask import abort, current_app, request
from flask_jwt_extended import get_jwt_identity
from extensions import db
from models.user import User


def validate_password(password):
    if not isinstance(password, str) or len(password) < 12 or len(password.encode("utf-8")) > 72:
        raise ValueError("Use a password of at least 12 characters and at most 72 UTF-8 bytes.")


def normalize_profile_name(value):
    if not isinstance(value, str):
        abort(400, description="Profile name must be a string.")
    value = " ".join(value.split())
    if not value or len(value) > 150 or any(ord(char) < 32 for char in value):
        abort(400, description="Profile name must contain 1–150 printable characters.")
    return value


def auth_version(user):
    # A password/role change invalidates every previously issued session.
    # Only the keyed fingerprint is embedded in JWTs, never the password hash.
    value = f"{user.id}:{user.password_hash}:{user.role}".encode()
    return hmac.new(current_app.config["JWT_SECRET_KEY"].encode(), value, hashlib.sha256).hexdigest()


def current_user():
    identity = get_jwt_identity()
    if identity is None:
        return None
    try:
        return db.session.get(User, int(identity))
    except (TypeError, ValueError):
        return None


def require_content_access(content, owner_id):
    user = current_user()
    if content.status != "published" and not (user and (user.role == "admin" or user.id == owner_id)):
        abort(404)


def visible_query(query, model, owner_column, status):
    allowed = {"published", "removed"} | ({"draft"} if model.__tablename__ == "blogs" else set())
    if status not in allowed | {"all"}:
        abort(400, description="Invalid publication status.")
    user = current_user()
    if status != "published":
        if not user:
            abort(401, description="Sign in to view your unpublished content.")
        if user.role != "admin":
            query = query.filter(owner_column == user.id)
    return query if status == "all" else query.filter(model.status == status)


def json_object():
    data = request.get_json()
    if not isinstance(data, dict):
        abort(400, description="A JSON object is required.")
    return data


def text_field(data, key, default="", max_length=None):
    value = data.get(key, default)
    if not isinstance(value, str):
        abort(400, description=f"{key} must be a string.")
    value = value.strip()
    if max_length is not None and len(value) > max_length:
        abort(400, description=f"{key} is too long (maximum {max_length} characters).")
    return value


def safe_url(value):
    if not isinstance(value, str):
        abort(400, description="URLs must be strings.")
    value = value.strip()
    try:
        parsed = urlsplit(value)
        valid = parsed.scheme in {"http", "https"} and parsed.hostname and not parsed.username and not parsed.password
        parsed.port  # Validate malformed port numbers, too.
    except ValueError:
        valid = False
    if value and (not valid or any(ord(char) < 32 for char in value)):
        abort(400, description="Use a valid HTTP or HTTPS URL.")
    return value


def tags_field(data):
    value = data.get("tags", "")
    if isinstance(value, list) and len(value) <= 30 and all(isinstance(tag, str) for tag in value):
        value = ", ".join(tag.strip() for tag in value)
    return text_field({"tags": value}, "tags", max_length=255)
