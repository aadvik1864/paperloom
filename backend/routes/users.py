from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models.user import User
from models.paper import Paper
from models.blog import Blog
from models.interactions import Bookmark
from services.r2_storage import r2_storage

users_bp = Blueprint("users", __name__)


@users_bp.route("/<int:user_id>", methods=["GET"])
def get_profile(user_id):
    user = User.query.get_or_404(user_id)
    return jsonify({"user": user.to_dict()}), 200


@users_bp.route("/<int:user_id>/papers", methods=["GET"])
def get_user_papers(user_id):
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    status = request.args.get("status", "published")

    query = Paper.query.filter_by(primary_author_id=user_id, status=status)
    query = query.order_by(Paper.published_at.desc())
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        "papers": [p.to_dict() for p in pagination.items],
        "total": pagination.total,
        "pages": pagination.pages,
        "page": pagination.page,
    }), 200


@users_bp.route("/<int:user_id>/blogs", methods=["GET"])
def get_user_blogs(user_id):
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    status = request.args.get("status", "published")

    query = Blog.query.filter_by(author_id=user_id, status=status)
    query = query.order_by(Blog.published_at.desc())
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        "blogs": [b.to_dict() for b in pagination.items],
        "total": pagination.total,
        "pages": pagination.pages,
        "page": pagination.page,
    }), 200


@users_bp.route("/profile", methods=["PUT"])
@jwt_required()
def update_profile():
    user_id = get_jwt_identity()
    user = User.query.get_or_404(user_id)

    data = request.get_json() or {}

    editable = ["profile_name", "bio", "institution", "department", "website", "google_scholar", "linkedin", "researchgate"]
    for field in editable:
        if field in data:
            setattr(user, field, data[field].strip())

    # Handle profile photo upload separately
    if "profile_photo" in request.files:
        file = request.files["profile_photo"]
        if file.filename:
            try:
                key = r2_storage.upload_file(file, folder="avatars")
                user.profile_photo_url = key
            except RuntimeError as e:
                return jsonify({"message": str(e)}), 500

    db.session.commit()
    return jsonify({"message": "Profile updated.", "user": user.to_dict()}), 200


@users_bp.route("/dashboard", methods=["GET"])
@jwt_required()
def get_dashboard():
    user_id = get_jwt_identity()
    user = User.query.get_or_404(user_id)

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
    user_id = get_jwt_identity()
    bookmarks = Bookmark.query.filter_by(user_id=user_id).order_by(Bookmark.created_at.desc()).all()
    papers = []
    for bm in bookmarks:
        if bm.paper:
            paper_data = bm.paper.to_dict()
            papers.append(paper_data)
    return jsonify({"bookmarks": papers}), 200
