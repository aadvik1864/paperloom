import io
from flask import Blueprint, request, jsonify, send_file
from werkzeug.datastructures import FileStorage
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db, limiter
from models.user import User
from models.paper import Paper
from models.blog import Blog
from models.interactions import Bookmark
from services.r2_storage import r2_storage, STORAGE_ERRORS
from services.file_lifecycle import commit_files
from utils.security import visible_query, json_object, text_field, safe_url, normalize_profile_name
from services.converter import validate_avatar

users_bp = Blueprint("users", __name__)


@users_bp.route("/<int:user_id>", methods=["GET"])
def get_profile(user_id):
    user = db.get_or_404(User, user_id)
    return jsonify({"user": user.to_dict()}), 200


@users_bp.route("/<int:user_id>/avatar", methods=["GET"])
def get_avatar(user_id):
    user = db.get_or_404(User, user_id)
    key = user.profile_photo_url
    if not key or not key.startswith("avatars/"):
        return jsonify({"message": "Avatar not found."}), 404
    try:
        image = validate_avatar(FileStorage(
            stream=io.BytesIO(r2_storage.download_file(key)), filename="avatar.jpg"))
    except ValueError:
        return jsonify({"message": "Avatar not available."}), 404
    except STORAGE_ERRORS:
        return jsonify({"message": "Avatar storage is unavailable."}), 503
    return send_file(image.stream, mimetype="image/jpeg")


@users_bp.route("/<int:user_id>/papers", methods=["GET"])
@jwt_required(optional=True)
def get_user_papers(user_id):
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    status = request.args.get("status", "published")

    query = visible_query(Paper.query.filter_by(primary_author_id=user_id), Paper, Paper.primary_author_id, status)
    query = query.order_by(Paper.published_at.desc())
    pagination = query.paginate(page=page, per_page=per_page, max_per_page=50, error_out=False)

    return jsonify({
        "papers": [p.to_dict() for p in pagination.items],
        "total": pagination.total,
        "pages": pagination.pages,
        "page": pagination.page,
    }), 200


@users_bp.route("/<int:user_id>/blogs", methods=["GET"])
@jwt_required(optional=True)
def get_user_blogs(user_id):
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    status = request.args.get("status", "published")

    query = visible_query(Blog.query.filter_by(author_id=user_id), Blog, Blog.author_id, status)
    query = query.order_by(Blog.published_at.desc())
    pagination = query.paginate(page=page, per_page=per_page, max_per_page=50, error_out=False)

    return jsonify({
        "blogs": [b.to_dict() for b in pagination.items],
        "total": pagination.total,
        "pages": pagination.pages,
        "page": pagination.page,
    }), 200


@users_bp.route("/profile", methods=["PUT"])
@jwt_required()
@limiter.limit("30 per hour")
def update_profile():
    user_id = int(get_jwt_identity())
    user = User.query.filter_by(id=user_id).with_for_update().first_or_404()

    data = request.form.to_dict() if request.mimetype == "multipart/form-data" else json_object()

    editable = ["profile_name", "bio", "institution", "department", "website", "google_scholar", "linkedin", "researchgate"]
    for field in editable:
        if field in data:
            value = text_field(data, field, max_length=5000 if field == "bio" else (150 if field == "profile_name" else 255))
            if field in {"website", "google_scholar", "linkedin", "researchgate"}:
                value = safe_url(value)
            if field == "profile_name":
                value = normalize_profile_name(value)
                duplicate = User.query.filter(User.profile_name == value, User.id != user.id).first()
                if duplicate:
                    return jsonify({"message": "That profile name is already in use."}), 400
            setattr(user, field, value)

    old_key = user.profile_photo_url
    key = None
    if "profile_photo" in request.files:
        file = request.files["profile_photo"]
        if file.filename:
            try:
                key = r2_storage.upload_file(validate_avatar(file), folder="avatars")
                user.profile_photo_url = key
            except ValueError as e:
                return jsonify({"message": str(e)}), 400
            except STORAGE_ERRORS:
                return jsonify({"message": "Avatar storage is unavailable."}), 503

    commit_files(uploaded=[key], obsolete=[old_key] if key and old_key and old_key.startswith("avatars/") else [])
    return jsonify({"message": "Profile updated.", "user": user.to_dict()}), 200


@users_bp.route("/dashboard", methods=["GET"])
@jwt_required()
def get_dashboard():
    user_id = int(get_jwt_identity())
    user = db.get_or_404(User, user_id)

    total_papers = Paper.query.filter_by(primary_author_id=user_id).count()
    total_views = db.session.query(db.func.sum(Paper.view_count)).filter(Paper.primary_author_id == user_id).scalar() or 0
    total_downloads = db.session.query(db.func.sum(Paper.download_count)).filter(Paper.primary_author_id == user_id).scalar() or 0
    total_blogs = Blog.query.filter_by(author_id=user_id).count()
    total_bookmarks = Bookmark.query.filter_by(user_id=user_id).count()

    recent_papers = Paper.query.filter_by(primary_author_id=user_id).order_by(Paper.created_at.desc()).limit(5).all()
    recent_blogs = Blog.query.filter_by(author_id=user_id).order_by(Blog.created_at.desc()).limit(5).all()

    return jsonify({
        "stats": {
            "total_papers": total_papers,
            "total_views": total_views,
            "total_downloads": total_downloads,
            "total_blogs": total_blogs,
            "total_bookmarks": total_bookmarks,
        },
        "recent_papers": [p.to_dict() for p in recent_papers],
        "recent_blogs": [b.to_dict() for b in recent_blogs],
        "user": user.to_dict(),
    }), 200


@users_bp.route("/bookmarks", methods=["GET"])
@jwt_required()
def get_bookmarks():
    user_id = int(get_jwt_identity())
    bookmarks = Bookmark.query.filter_by(user_id=user_id).order_by(Bookmark.created_at.desc()).all()
    user = db.session.get(User, user_id)
    papers = []
    for bm in bookmarks:
        if bm.paper and (bm.paper.status == "published" or bm.paper.primary_author_id == user_id or user.role == "admin"):
            paper_data = bm.paper.to_dict()
            papers.append(paper_data)
    return jsonify({"bookmarks": papers}), 200
