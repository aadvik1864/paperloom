import os
from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models.paper import Paper, Category
from models.interactions import Bookmark, Citation
from models.user import User
from utils.decorators import role_required
from services.r2_storage import r2_storage
from services.converter import converter
import tempfile
import io

papers_bp = Blueprint("papers", __name__)


def generate_citations(paper):
    paper_dict = paper.to_dict()
    authors = paper_dict.get("authors", "Unknown")
    title = paper_dict.get("title", "Untitled")
    year = paper_dict.get("published_at", "")[:4] if paper_dict.get("published_at") else "n.d."
    institution = paper_dict.get("institution", "")

    citations = {
        "APA": f"{authors} ({year}). {title}. {institution}.",
        "MLA": f"{authors}. \"{title}.\" {institution}, {year}.",
        "BibTeX": f"@article{{,\n  author = {{{authors}}},\n  title = {{{title}}},\n  year = {{{year}}},\n  institution = {{{institution}}}\n}}",
    }
    return citations


@papers_bp.route("", methods=["GET"])
def list_papers():
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    category_id = request.args.get("category_id", type=int)
    author_id = request.args.get("author_id", type=int)
    search = request.args.get("search", "").strip()
    sort = request.args.get("sort", "newest")
    status = request.args.get("status", "published")

    query = Paper.query.filter_by(status=status)

    if category_id:
        query = query.filter_by(category_id=category_id)
    if author_id:
        query = query.filter_by(primary_author_id=author_id)
    if search:
        term = f"%{search}%"
        query = query.filter(
            db.or_(
                Paper.title.ilike(term),
                Paper.abstract.ilike(term),
                Paper.authors.ilike(term),
                Paper.keywords.ilike(term),
                Paper.institution.ilike(term),
            )
        )

    if sort == "oldest":
        query = query.order_by(Paper.published_at.asc())
    elif sort == "most_viewed":
        query = query.order_by(Paper.view_count.desc())
    elif sort == "most_downloaded":
        query = query.order_by(Paper.download_count.desc())
    else:
        query = query.order_by(Paper.published_at.desc())

    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        "papers": [p.to_dict() for p in pagination.items],
        "total": pagination.total,
        "pages": pagination.pages,
        "page": pagination.page,
    }), 200


@papers_bp.route("/categories", methods=["GET"])
def list_categories():
    categories = Category.query.all()
    return jsonify({"categories": [c.to_dict() for c in categories]}), 200


@papers_bp.route("/<int:paper_id>", methods=["GET"])
def get_paper(paper_id):
    paper = Paper.query.get_or_404(paper_id)

    paper.view_count += 1
    db.session.commit()

    citations = generate_citations(paper)

    data = paper.to_dict()
    data["citations"] = citations
    data["pdf_url"] = r2_storage.get_url(paper.pdf_url) if r2_storage.client else paper.pdf_url

    return jsonify({"paper": data}), 200


@papers_bp.route("/<int:paper_id>/download", methods=["GET"])
def download_paper(paper_id):
    paper = Paper.query.get_or_404(paper_id)

    paper.download_count += 1
    db.session.commit()

    if not r2_storage.client:
        return jsonify({"message": "Storage not configured"}), 500

    download_url = r2_storage.get_url(paper.pdf_url)
    return jsonify({"download_url": download_url}), 200


@papers_bp.route("/<int:paper_id>/citations", methods=["GET"])
def get_citations(paper_id):
    paper = Paper.query.get_or_404(paper_id)
    return jsonify({"citations": generate_citations(paper)}), 200


@papers_bp.route("", methods=["POST"])
@jwt_required()
@role_required(["author", "admin"])
def create_paper():
    user_id = int(get_jwt_identity())

    if "file" not in request.files:
        return jsonify({"message": "No file provided."}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"message": "No file selected."}), 400

    title = request.form.get("title", "").strip()
    abstract = request.form.get("abstract", "").strip()
    authors = request.form.get("authors", "").strip()
    keywords = request.form.get("keywords", "").strip()
    institution = request.form.get("institution", "").strip()
    department = request.form.get("department", "").strip()
    category_id = request.form.get("category_id", type=int)

    if not title or not abstract or not authors or not category_id:
        return jsonify({"message": "Title, abstract, authors, and category are required."}), 400

    # Convert DOCX to PDF if needed
    try:
        pdf_file = converter.convert_to_pdf(file)
    except (ValueError, RuntimeError) as e:
        return jsonify({"message": str(e)}), 400

    # Upload to R2
    try:
        pdf_key = r2_storage.upload_file(pdf_file, folder="papers")
    except RuntimeError as e:
        return jsonify({"message": str(e)}), 500

    paper = Paper(
        title=title,
        abstract=abstract,
        keywords=keywords,
        authors=authors,
        primary_author_id=user_id,
        institution=institution,
        department=department,
        category_id=category_id,
        pdf_url=pdf_key,
        status="published",
    )
    db.session.add(paper)
    db.session.commit()

    return jsonify({
        "message": "Paper published successfully.",
        "paper": paper.to_dict(),
    }), 201


@papers_bp.route("/<int:paper_id>", methods=["PUT"])
@jwt_required()
@role_required(["author", "admin"])
def update_paper(paper_id):
    user_id = int(get_jwt_identity())
    paper = Paper.query.get_or_404(paper_id)

    if paper.primary_author_id != user_id:
        user = User.query.get(user_id)
        if user.role != "admin":
            return jsonify({"message": "You can only edit your own papers."}), 403

    data = request.form.to_dict() if request.form else (request.get_json() or {})

    if "title" in data:
        paper.title = data["title"].strip()
    if "abstract" in data:
        paper.abstract = data["abstract"].strip()
    if "keywords" in data:
        paper.keywords = data["keywords"].strip()
    if "authors" in data:
        paper.authors = data["authors"].strip()
    if "institution" in data:
        paper.institution = data["institution"].strip()
    if "department" in data:
        paper.department = data["department"].strip()
    if "category_id" in data:
        paper.category_id = int(data["category_id"])

    # Handle file replacement
    if "file" in request.files:
        file = request.files["file"]
        if file.filename != "":
            try:
                pdf_file = converter.convert_to_pdf(file)
                pdf_key = r2_storage.upload_file(pdf_file, folder="papers")
                # Delete old file
                if paper.pdf_url:
                    try:
                        r2_storage.delete_file(paper.pdf_url)
                    except Exception:
                        pass
                paper.pdf_url = pdf_key
            except (ValueError, RuntimeError) as e:
                return jsonify({"message": str(e)}), 400

    db.session.commit()
    return jsonify({
        "message": "Paper updated successfully.",
        "paper": paper.to_dict(),
    }), 200


@papers_bp.route("/<int:paper_id>", methods=["DELETE"])
@jwt_required()
@role_required(["author", "admin"])
def delete_paper(paper_id):
    user_id = int(get_jwt_identity())
    paper = Paper.query.get_or_404(paper_id)

    if paper.primary_author_id != user_id:
        user = User.query.get(user_id)
        if user.role != "admin":
            return jsonify({"message": "You can only delete your own papers."}), 403

    if paper.pdf_url:
        try:
            r2_storage.delete_file(paper.pdf_url)
        except Exception:
            pass

    db.session.delete(paper)
    db.session.commit()

    return jsonify({"message": "Paper deleted successfully."}), 200


@papers_bp.route("/<int:paper_id>/bookmark", methods=["POST"])
@jwt_required()
def toggle_bookmark(paper_id):
    user_id = int(get_jwt_identity())
    paper = Paper.query.get_or_404(paper_id)

    bookmark = Bookmark.query.filter_by(user_id=user_id, paper_id=paper_id).first()
    if bookmark:
        db.session.delete(bookmark)
        db.session.commit()
        return jsonify({"message": "Bookmark removed.", "bookmarked": False}), 200

    bookmark = Bookmark(user_id=user_id, paper_id=paper_id)
    db.session.add(bookmark)
    db.session.commit()
    return jsonify({"message": "Paper bookmarked.", "bookmarked": True}), 201


@papers_bp.route("/<int:paper_id>/bookmark", methods=["GET"])
@jwt_required()
def check_bookmark(paper_id):
    user_id = int(get_jwt_identity())
    bookmark = Bookmark.query.filter_by(user_id=user_id, paper_id=paper_id).first()
    return jsonify({"bookmarked": bookmark is not None}), 200
