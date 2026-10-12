from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models.user import User
from models.paper import Paper, Category
from models.blog import Blog
from utils.decorators import role_required
from services.file_lifecycle import commit_files
from services.audit import audit_event
from services.sessions import session_store
from utils.security import json_object, text_field, validate_password, normalize_profile_name

admin_bp = Blueprint("admin", __name__)


def lock_administrators():
    if db.engine.dialect.name == "postgresql":
        db.session.execute(db.text("SELECT pg_advisory_xact_lock(76614201)"))
    actor = db.session.get(User, int(get_jwt_identity()), populate_existing=True)
    if not actor or actor.role != "admin":
        from flask import abort
        abort(403, description="Administrator access is required.")


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

    audit_event("create_user", "user", user.id)

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
    audit_event("reset_password", "user", user.id)
    return jsonify({"message": f"Password updated for '{user.profile_name}'."}), 200


@admin_bp.route("/users/<int:user_id>/role", methods=["PUT"])
@jwt_required()
@role_required("admin")
def update_user_role(user_id):
    lock_administrators()
    user = User.query.get_or_404(user_id)
    data = json_object()

    new_role = text_field(data, "role")
    if new_role not in ("visitor", "author", "admin"):
        return jsonify({"message": "Invalid role."}), 400
    if user.role == "admin" and new_role != "admin" and User.query.filter_by(role="admin").count() <= 1:
        return jsonify({"message": "Keep at least one administrator. Promote another profile first."}), 409

    if user.role != new_role:
        # Revoke before committing; a Redis outage must not save an unrevoked role change.
        session_store().revoke_user(str(user.id))
    user.role = new_role
    db.session.commit()
    audit_event("change_role", "user", user.id)
    return jsonify({"message": "User role updated.", "user": user.to_dict()}), 200


@admin_bp.route("/users/<int:user_id>", methods=["DELETE"])
@jwt_required()
@role_required("admin")
def delete_user(user_id):
    lock_administrators()
    if user_id == int(get_jwt_identity()):
        return jsonify({"message": "You cannot delete yourself."}), 400

    user = User.query.get_or_404(user_id)
    if user.role == "admin" and User.query.filter_by(role="admin").count() <= 1:
        return jsonify({"message": "The last administrator cannot be deleted."}), 409
    old_keys = [p.pdf_url for p in user.papers]
    if user.profile_photo_url and user.profile_photo_url.startswith("avatars/"):
        old_keys.append(user.profile_photo_url)
    db.session.delete(user)
    commit_files(obsolete=old_keys)
    audit_event("delete_user", "user", user_id)
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
    audit_event("toggle_status", "paper", paper.id)
    return jsonify({"message": f"Paper status changed to '{new_status}'.", "paper": paper.to_dict()}), 200


@admin_bp.route("/papers/<int:paper_id>/delete", methods=["DELETE"])
@jwt_required()
@role_required("admin")
def admin_delete_paper(paper_id):
    paper = Paper.query.filter_by(id=paper_id).with_for_update().first_or_404()
    old_key = paper.pdf_url
    db.session.delete(paper)
    commit_files(obsolete=[old_key])
    audit_event("delete_paper", "paper", paper_id)
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
    audit_event("toggle_status", "blog", blog.id)
    return jsonify({"message": f"Blog status changed to '{new_status}'.", "blog": blog.to_dict()}), 200


@admin_bp.route("/blogs/<int:blog_id>/delete", methods=["DELETE"])
@jwt_required()
@role_required("admin")
def admin_delete_blog(blog_id):
    blog = Blog.query.get_or_404(blog_id)
    db.session.delete(blog)
    db.session.commit()
    audit_event("delete_blog", "blog", blog_id)
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
