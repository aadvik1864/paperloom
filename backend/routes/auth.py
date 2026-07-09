from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from models.user import User

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json() or {}

    profile_name = data.get('profile_name', '').strip()
    password = data.get('password', '')

    if not profile_name or not password:
        return jsonify({"message": "Profile name and password are required."}), 400

    user = User.query.filter_by(profile_name=profile_name).first()

    if not user or not user.check_password(password):
        return jsonify({"message": "Invalid profile name or password."}), 401

    access_token = create_access_token(identity=user.id)

    return jsonify({
        "message": "Login successful.",
        "user": user.to_dict(),
        "token": access_token
    }), 200


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"message": "User not found"}), 404

    return jsonify({"user": user.to_dict()}), 200
