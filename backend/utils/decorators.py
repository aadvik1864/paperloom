from functools import wraps
from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
from extensions import db
from models.user import User


def role_required(allowed_roles):
    """Require one of the supplied roles; accepts a role string or a sequence."""
    if isinstance(allowed_roles, str):
        allowed_roles = [allowed_roles]

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            user_id = int(get_jwt_identity())
            user = db.session.get(User, user_id)

            if not user:
                return jsonify({"message": "User not found"}), 404

            if user.role not in allowed_roles:
                return jsonify({"message": f"Unauthorized. Role '{user.role}' is not allowed."}), 403

            return fn(*args, **kwargs)
        return wrapper
    return decorator
