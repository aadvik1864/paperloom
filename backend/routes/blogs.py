import re
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db, limiter
from models.blog import Blog
from models.interactions import Comment
from models.user import User
from utils.decorators import role_required
from services.r2_storage import r2_storage
from utils.security import require_content_access, visible_query, json_object, text_field, safe_url, tags_field

blogs_bp = Blueprint("blogs", __name__)


def slugify(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


@blogs_bp.route("", methods=["GET"])
@jwt_required(optional=True)
def list_blogs():
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    category = request.args.get("category", "").strip()
    search = request.args.get("search", "").strip()
    author_id = request.args.get("author_id", type=int)
    status = request.args.get("status", "published")

    query = visible_query(Blog.query, Blog, Blog.author_id, status)

    if category:
        query = query.filter_by(category=category)
    if author_id:
        query = query.filter_by(author_id=author_id)
    if search:
        term = f"%{search}%"
        query = query.filter(
            db.or_(
                Blog.title.ilike(term),
                Blog.content.ilike(term),
                Blog.tags.ilike(term),
            )
        )

    query = query.order_by(Blog.published_at.desc())
    pagination = query.paginate(page=page, per_page=per_page, max_per_page=50, error_out=False)

    return jsonify({
        "blogs": [b.to_dict() for b in pagination.items],
        "total": pagination.total,
        "pages": pagination.pages,
        "page": pagination.page,
    }), 200


@blogs_bp.route("/<string:slug_or_id>", methods=["GET"])
@jwt_required(optional=True)
def get_blog(slug_or_id):
    blog = None
    if slug_or_id.isdigit():
        blog = Blog.query.get(int(slug_or_id))
    if not blog:
        blog = Blog.query.filter_by(slug=slug_or_id).first()

    if not blog:
        return jsonify({"message": "Blog not found."}), 404
    require_content_access(blog, blog.author_id)

    blog.view_count += 1
    db.session.commit()

    return jsonify({"blog": blog.to_dict(include_comments=True)}), 200


@blogs_bp.route("", methods=["POST"])
@jwt_required()
@role_required(["author", "admin"])
def create_blog():
    user_id = int(get_jwt_identity())
    data = json_object()

    title = text_field(data, "title", max_length=255)
    content = text_field(data, "content", max_length=100000)
    category = text_field(data, "category", max_length=100)
    tags = tags_field(data)
    cover_image_url = safe_url(data.get("cover_image_url", ""))
    status = text_field(data, "status", "published")
    if status not in {"draft", "published", "removed"}:
        return jsonify({"message": "Choose draft, published, or removed."}), 400

    if not title or not content:
        return jsonify({"message": "Title and content are required."}), 400
    if not slugify(title):
        return jsonify({"message": "Title must include a letter or number."}), 400

    base_slug = slugify(title)[:240] or "post"
    slug = base_slug
    counter = 1
    while Blog.query.filter_by(slug=slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    blog = Blog(
        title=title,
        slug=slug,
        content=content,
        cover_image_url=cover_image_url,
        author_id=user_id,
        category=category,
        tags=tags,
        status=status,
        published_at=__import__("datetime").datetime.utcnow() if status == "published" else None,
    )
    db.session.add(blog)
    db.session.commit()

    return jsonify({"message": "Blog created successfully.", "blog": blog.to_dict()}), 201


@blogs_bp.route("/<int:blog_id>", methods=["PUT"])
@jwt_required()
@role_required(["author", "admin"])
def update_blog(blog_id):
    user_id = int(get_jwt_identity())
    blog = Blog.query.get_or_404(blog_id)

    if blog.author_id != user_id:
        user = User.query.get(user_id)
        if user.role != "admin":
            return jsonify({"message": "You can only edit your own blogs."}), 403

    data = json_object()

    if "title" in data:
        blog.title = text_field(data, "title", max_length=255)
    if "content" in data:
        blog.content = text_field(data, "content", max_length=100000)
    if "category" in data:
        blog.category = text_field(data, "category", max_length=100)
    if "tags" in data:
        blog.tags = tags_field(data)
    if "title" in data and not slugify(blog.title):
        return jsonify({"message": "Title must include a letter or number."}), 400
    if "cover_image_url" in data:
        blog.cover_image_url = safe_url(data["cover_image_url"])
    if "status" in data:
        old_status = blog.status
        blog.status = text_field(data, "status")
        if blog.status not in {"draft", "published", "removed"}:
            return jsonify({"message": "Choose draft, published, or removed."}), 400
        if blog.status == "published" and old_status != "published":
            blog.published_at = __import__("datetime").datetime.utcnow()

    db.session.commit()
    return jsonify({"message": "Blog updated successfully.", "blog": blog.to_dict()}), 200


@blogs_bp.route("/<int:blog_id>", methods=["DELETE"])
@jwt_required()
@role_required(["author", "admin"])
def delete_blog(blog_id):
    user_id = int(get_jwt_identity())
    blog = Blog.query.get_or_404(blog_id)

    if blog.author_id != user_id:
        user = User.query.get(user_id)
        if user.role != "admin":
            return jsonify({"message": "You can only delete your own blogs."}), 403

    db.session.delete(blog)
    db.session.commit()
    return jsonify({"message": "Blog deleted successfully."}), 200


@blogs_bp.route("/<int:blog_id>/comments", methods=["POST"])
@jwt_required()
@limiter.limit("20 per minute")
def add_comment(blog_id):
    user_id = int(get_jwt_identity())
    blog = Blog.query.get_or_404(blog_id)
    require_content_access(blog, blog.author_id)
    data = json_object()

    content = text_field(data, "content", max_length=5000)
    if not content:
        return jsonify({"message": "Comment content is required."}), 400

    comment = Comment(
        blog_id=blog_id,
        user_id=user_id,
        content=content,
    )
    db.session.add(comment)
    db.session.commit()

    return jsonify({"message": "Comment added.", "comment": comment.to_dict()}), 201


@blogs_bp.route("/comments/<int:comment_id>", methods=["DELETE"])
@jwt_required()
def delete_comment(comment_id):
    user_id = int(get_jwt_identity())
    comment = Comment.query.get_or_404(comment_id)

    if comment.user_id != user_id:
        user = User.query.get(user_id)
        if user.role != "admin":
            return jsonify({"message": "You can only delete your own comments."}), 403

    db.session.delete(comment)
    db.session.commit()
    return jsonify({"message": "Comment deleted."}), 200
