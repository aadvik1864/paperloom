from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from models.user import User
from extensions import limiter
from utils.security import auth_version, json_object, normalize_profile_name
import hashlib


def login_profile_key():
    data = request.get_json(silent=True)
    name = data.get("profile_name", "") if isinstance(data, dict) else ""
    name = " ".join(name.split()).casefold() if isinstance(name, str) else ""
    return "profile:" + hashlib.sha256(name.encode()).hexdigest()

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/login', methods=['POST'])
@limiter.limit("5 per minute; 30 per hour")
@limiter.limit("10 per minute; 50 per hour", key_func=login_profile_key)
def login():
    data = json_object()

    profile_name = data.get('profile_name', '')
    password = data.get('password', '')
    if not isinstance(profile_name, str) or not isinstance(password, str):
        return jsonify({"message": "Profile name and password must be strings."}), 400
    profile_name = " ".join(profile_name.split())

    if not profile_name or not password:
        return jsonify({"message": "Profile name and password are required."}), 400
    profile_name = normalize_profile_name(profile_name)

    user = User.query.filter_by(profile_name=profile_name).first()

    if user:
        valid = user.check_password(password)
    else:
        # Avoid the fast "unknown profile" response revealing account names.
        User(profile_name="invalid", role="visitor").check_password(password)
        valid = False
    if not valid:
        return jsonify({"message": "Invalid profile name or password."}), 401

    access_token = create_access_token(identity=str(user.id), additional_claims={"auth_version": auth_version(user)})

    return jsonify({
        "message": "Login successful.",
        "user": user.to_dict(),
        "token": access_token
    }), 200


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if not user:
        return jsonify({"message": "User not found"}), 404

    return jsonify({"user": user.to_dict()}), 200
