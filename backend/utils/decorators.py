from functools import wraps
from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
from models.user import User

def role_required(allowed_roles):
    """
    Decorator to restrict access to users with specific roles.
    allowed_roles can be a list/tuple of strings, e.g. ['author', 'admin'], or a single string.
    """
    if isinstance(allowed_roles, str):
        allowed_roles = [allowed_roles]
        
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            user_id = get_jwt_identity()
            user = User.query.get(user_id)
            
            if not user:
                return jsonify({"message": "User not found"}), 404
                
            if user.role not in allowed_roles:
                return jsonify({"message": f"Unauthorized. Role '{user.role}' is not allowed."}), 403
                
            return fn(*args, **kwargs)
        return wrapper
    return decorator
