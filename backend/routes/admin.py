from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models.user import User
from models.paper import Paper, Category
from models.blog import Blog
from utils.decorators import role_required
from services.r2_storage import r2_storage
from utils.security import json_object, text_field, validate_password, normalize_profile_name

admin_bp = Blueprint("admin", __name__)


@admin_bp.route("/users", methods=["POST"])
@jwt_required()
@role_required("admin")
def create_user():
    data = json_object()

    profile_name = normalize_profile_name(data.get("profile_name", ""))
    password = data.get("password", "")
    role = text_field(data, "role", "visitor")

    if not profile_name or not password:
        return jsonify({"message": "Profile name and password are required."}), 400

    try:
        validate_password(password)
    except ValueError as error:
        return jsonify({"message": str(error)}), 400

    if role not in ("visitor", "author", "admin"):
        return jsonify({"message": "Invalid role."}), 400

    if User.query.filter_by(profile_name=profile_name).first():
        return jsonify({"message": "Profile name already exists."}), 400

    user = User(profile_name=profile_name, role=role)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    return jsonify({
        "message": f"Profile '{profile_name}' created successfully.",
        "user": user.to_dict(),
    }), 201


@admin_bp.route("/users", methods=["GET"])
@jwt_required()
@role_required("admin")
def list_users():
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 50, type=int)
    search = request.args.get("search", "").strip()

    query = User.query
    if search:
        term = f"%{search}%"
        query = query.filter(User.profile_name.ilike(term))

    query = query.order_by(User.created_at.desc())
    pagination = query.paginate(page=page, per_page=per_page, max_per_page=50, error_out=False)

    return jsonify({
        "users": [u.to_dict() for u in pagination.items],
        "total": pagination.total,
        "pages": pagination.pages,
        "page": pagination.page,
    }), 200


@admin_bp.route("/users/<int:user_id>", methods=["GET"])
@jwt_required()
@role_required("admin")
def get_user(user_id):
    user = User.query.get_or_404(user_id)
    return jsonify({"user": user.to_dict()}), 200


@admin_bp.route("/users/<int:user_id>/password", methods=["PUT"])
@jwt_required()
@role_required("admin")
def admin_set_password(user_id):
    user = User.query.get_or_404(user_id)
    data = json_object()

    new_password = data.get("password", "")
    try:
        validate_password(new_password)
    except ValueError as error:
        return jsonify({"message": str(error)}), 400

    user.set_password(new_password)
    db.session.commit()
    return jsonify({"message": f"Password updated for '{user.profile_name}'."}), 200


@admin_bp.route("/users/<int:user_id>/role", methods=["PUT"])
@jwt_required()
@role_required("admin")
def update_user_role(user_id):
    user = User.query.get_or_404(user_id)
    data = json_object()

    new_role = text_field(data, "role")
    if new_role not in ("visitor", "author", "admin"):
        return jsonify({"message": "Invalid role."}), 400

    user.role = new_role
    db.session.commit()
    return jsonify({"message": "User role updated.", "user": user.to_dict()}), 200


@admin_bp.route("/users/<int:user_id>", methods=["DELETE"])
@jwt_required()
@role_required("admin")
def delete_user(user_id):
    if user_id == int(get_jwt_identity()):
        return jsonify({"message": "You cannot delete yourself."}), 400

    user = User.query.get_or_404(user_id)
    db.session.delete(user)
    db.session.commit()
    return jsonify({"message": "User deleted successfully."}), 200


@admin_bp.route("/papers", methods=["GET"])
@jwt_required()
@role_required("admin")
def list_all_papers():
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    status = request.args.get("status", "").strip()

    query = Paper.query
    if status:
        query = query.filter_by(status=status)

    query = query.order_by(Paper.created_at.desc())
    pagination = query.paginate(page=page, per_page=per_page, max_per_page=50, error_out=False)

    return jsonify({
        "papers": [p.to_dict() for p in pagination.items],
        "total": pagination.total,
        "pages": pagination.pages,
        "page": pagination.page,
    }), 200


@admin_bp.route("/papers/<int:paper_id>/toggle-status", methods=["PUT"])
@jwt_required()
@role_required("admin")
def toggle_paper_status(paper_id):
    paper = Paper.query.get_or_404(paper_id)
    new_status = "removed" if paper.status == "published" else "published"
    paper.status = new_status
    db.session.commit()
    return jsonify({"message": f"Paper status changed to '{new_status}'.", "paper": paper.to_dict()}), 200


@admin_bp.route("/papers/<int:paper_id>/delete", methods=["DELETE"])
@jwt_required()
@role_required("admin")
def admin_delete_paper(paper_id):
    paper = Paper.query.get_or_404(paper_id)
    if paper.pdf_url:
        try:
            r2_storage.delete_file(paper.pdf_url)
        except Exception:
            pass
    db.session.delete(paper)
    db.session.commit()
    return jsonify({"message": "Paper permanently deleted."}), 200


@admin_bp.route("/blogs", methods=["GET"])
@jwt_required()
@role_required("admin")
def list_all_blogs():
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    status = request.args.get("status", "").strip()

    query = Blog.query
    if status:
        query = query.filter_by(status=status)

    query = query.order_by(Blog.created_at.desc())
    pagination = query.paginate(page=page, per_page=per_page, max_per_page=50, error_out=False)

    return jsonify({
        "blogs": [b.to_dict() for b in pagination.items],
        "total": pagination.total,
        "pages": pagination.pages,
        "page": pagination.page,
    }), 200


@admin_bp.route("/blogs/<int:blog_id>/toggle-status", methods=["PUT"])
@jwt_required()
@role_required("admin")
def toggle_blog_status(blog_id):
    blog = Blog.query.get_or_404(blog_id)
    new_status = "removed" if blog.status == "published" else "published"
    blog.status = new_status
    db.session.commit()
    return jsonify({"message": f"Blog status changed to '{new_status}'.", "blog": blog.to_dict()}), 200


@admin_bp.route("/blogs/<int:blog_id>/delete", methods=["DELETE"])
@jwt_required()
@role_required("admin")
def admin_delete_blog(blog_id):
    blog = Blog.query.get_or_404(blog_id)
    db.session.delete(blog)
    db.session.commit()
    return jsonify({"message": "Blog permanently deleted."}), 200


@admin_bp.route("/analytics", methods=["GET"])
@jwt_required()
@role_required("admin")
def get_analytics():
    total_users = User.query.count()
    total_papers = Paper.query.count()
    total_blogs = Blog.query.count()
    total_views = db.session.query(db.func.sum(Paper.view_count)).scalar() or 0
    total_downloads = db.session.query(db.func.sum(Paper.download_count)).scalar() or 0

    admin_count = User.query.filter_by(role="admin").count()
    author_count = User.query.filter_by(role="author").count()
    visitor_count = User.query.filter_by(role="visitor").count()

    categories = Category.query.all()
    category_breakdown = []
    for cat in categories:
        count = Paper.query.filter_by(category_id=cat.id).count()
        if count > 0:
            category_breakdown.append({"name": cat.name, "count": count})

    return jsonify({
        "stats": {
            "total_users": total_users,
            "total_papers": total_papers,
            "total_blogs": total_blogs,
            "total_views": total_views,
            "total_downloads": total_downloads,
        },
        "user_breakdown": {
            "admins": admin_count,
            "authors": author_count,
            "visitors": visitor_count,
        },
        "category_breakdown": category_breakdown,
    }), 200
