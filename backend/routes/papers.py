import io
from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db, limiter
from models.paper import Paper, Category
from models.interactions import Bookmark
from models.user import User
from utils.decorators import role_required
from services.r2_storage import r2_storage, STORAGE_ERRORS
from services.file_lifecycle import commit_files
from services.converter import converter
from werkzeug.utils import secure_filename
from utils.security import require_content_access, visible_query, json_object, text_field, positive_id

papers_bp = Blueprint("papers", __name__)


@papers_bp.route("/capabilities", methods=["GET"])
def upload_capabilities():
    office = converter.available()
    return jsonify({"office_conversion": office, "extensions": [".pdf"] + sorted(converter.SUPPORTED_EXTENSIONS) if office else [".pdf"]})


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
@jwt_required(optional=True)
def list_papers():
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    category_id = request.args.get("category_id", type=int)
    author_id = request.args.get("author_id", type=int)
    search = request.args.get("search", "").strip()
    sort = request.args.get("sort", "newest")
    status = request.args.get("status", "published")

    query = visible_query(Paper.query, Paper, Paper.primary_author_id, status)

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

    pagination = query.paginate(page=page, per_page=per_page, max_per_page=50, error_out=False)

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
@jwt_required(optional=True)
def get_paper(paper_id):
    paper = db.get_or_404(Paper, paper_id)
    require_content_access(paper, paper.primary_author_id)

    db.session.execute(db.update(Paper).where(Paper.id == paper.id).values(view_count=Paper.view_count + 1))
    db.session.commit()

    citations = generate_citations(paper)

    data = paper.to_dict()
    data["citations"] = citations
    data["pdf_url"] = f"/api/papers/{paper.id}/pdf"

    return jsonify({"paper": data}), 200


@papers_bp.route("/<int:paper_id>/pdf", methods=["GET"])
@jwt_required(optional=True)
def view_paper_pdf(paper_id):
    paper = db.get_or_404(Paper, paper_id)
    require_content_access(paper, paper.primary_author_id)

    if not r2_storage.client or not paper.pdf_url:
        return jsonify({"message": "PDF not available"}), 404

    try:
        pdf_data = r2_storage.download_file(paper.pdf_url)
        return send_file(
            io.BytesIO(pdf_data),
            mimetype="application/pdf",
            # PDF.js fetches bytes via XHR; direct navigation must not inline an
            # untrusted legacy PDF into the application origin.
            as_attachment=True,
            download_name=f"{secure_filename(paper.title) or 'paper'}.pdf",
        )
    except STORAGE_ERRORS:
        return jsonify({"message": "PDF storage is unavailable."}), 503


@papers_bp.route("/<int:paper_id>/download", methods=["GET"])
@jwt_required(optional=True)
def download_paper(paper_id):
    paper = db.get_or_404(Paper, paper_id)
    require_content_access(paper, paper.primary_author_id)

    if not r2_storage.client:
        return jsonify({"message": "PDF download is unavailable."}), 503
    if not paper.pdf_url:
        return jsonify({"message": "PDF not available."}), 404

    try:
        pdf_data = r2_storage.download_file(paper.pdf_url)
    except STORAGE_ERRORS:
        return jsonify({"message": "PDF download is unavailable."}), 503
    db.session.execute(db.update(Paper).where(Paper.id == paper.id).values(download_count=Paper.download_count + 1))
    db.session.commit()
    return send_file(io.BytesIO(pdf_data), mimetype="application/pdf", as_attachment=True,
                     download_name=f"{secure_filename(paper.title) or 'paper'}.pdf")


@papers_bp.route("/<int:paper_id>/citations", methods=["GET"])
@jwt_required(optional=True)
def get_citations(paper_id):
    paper = db.get_or_404(Paper, paper_id)
    require_content_access(paper, paper.primary_author_id)
    return jsonify({"citations": generate_citations(paper)}), 200


@papers_bp.route("", methods=["POST"])
@jwt_required()
@role_required(["author", "admin"])
@limiter.limit("20 per hour")
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
    category_id = positive_id(request.form.get("category_id", ""))

    if not title or not abstract or not authors or not category_id:
        return jsonify({"message": "Title, abstract, authors, and category are required."}), 400
    if not db.session.get(Category, category_id):
        return jsonify({"message": "Choose an existing category."}), 400
    if any(len(value) > 255 for value in (title, keywords, institution, department)) or len(abstract) > 100000 or len(authors) > 5000:
        return jsonify({"message": "Paper metadata exceeds the allowed length."}), 400

    try:
        pdf_file = converter.convert_to_pdf(file)
    except RuntimeError:
        return jsonify({"message": "Document conversion is unavailable. Upload a PDF instead."}), 503
    except ValueError as e:
        return jsonify({"message": str(e)}), 400
    except OSError:
        return jsonify({"message": "Document processing is unavailable. Upload a PDF instead."}), 503

    try:
        pdf_key = r2_storage.upload_file(pdf_file, folder="papers")
    except STORAGE_ERRORS:
        return jsonify({"message": "Paper storage is unavailable."}), 503

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
    commit_files(uploaded=[pdf_key])

    return jsonify({
        "message": "Paper published successfully.",
        "paper": paper.to_dict(),
    }), 201


@papers_bp.route("/<int:paper_id>", methods=["PUT"])
@jwt_required()
@role_required(["author", "admin"])
@limiter.limit("20 per hour")
def update_paper(paper_id):
    user_id = int(get_jwt_identity())
    paper = Paper.query.filter_by(id=paper_id).with_for_update().first_or_404()

    if paper.primary_author_id != user_id:
        user = db.session.get(User, user_id)
        if user.role != "admin":
            return jsonify({"message": "You can only edit your own papers."}), 403

    data = request.form.to_dict() if request.mimetype == "multipart/form-data" else json_object()

    if "title" in data:
        paper.title = text_field(data, "title", max_length=255)
    if "abstract" in data:
        paper.abstract = text_field(data, "abstract")
        if len(paper.abstract) > 100000:
            return jsonify({"message": "Abstract is too long."}), 400
    if "keywords" in data:
        paper.keywords = text_field(data, "keywords", max_length=255)
    if "authors" in data:
        paper.authors = text_field(data, "authors")
        if len(paper.authors) > 5000:
            return jsonify({"message": "Author details are too long."}), 400
    if "institution" in data:
        paper.institution = text_field(data, "institution", max_length=255)
    if "department" in data:
        paper.department = text_field(data, "department", max_length=255)
    if "category_id" in data:
        category_id = positive_id(data["category_id"])
        if not db.session.get(Category, category_id):
            return jsonify({"message": "Choose an existing category."}), 400
        paper.category_id = category_id

    if not paper.title or not paper.abstract or not paper.authors:
        return jsonify({"message": "Title, abstract, and authors cannot be blank."}), 400

    old_key = paper.pdf_url
    pdf_key = None
    if "file" in request.files:
        file = request.files["file"]
        if file.filename != "":
            try:
                pdf_file = converter.convert_to_pdf(file)
                pdf_key = r2_storage.upload_file(pdf_file, folder="papers")
                paper.pdf_url = pdf_key
            except STORAGE_ERRORS:
                return jsonify({"message": "Document conversion or storage is unavailable."}), 503
            except ValueError as e:
                return jsonify({"message": str(e)}), 400

    commit_files(uploaded=[pdf_key], obsolete=[old_key] if pdf_key else [])
    return jsonify({
        "message": "Paper updated successfully.",
        "paper": paper.to_dict(),
    }), 200


@papers_bp.route("/<int:paper_id>", methods=["DELETE"])
@jwt_required()
@role_required(["author", "admin"])
def delete_paper(paper_id):
    user_id = int(get_jwt_identity())
    paper = Paper.query.filter_by(id=paper_id).with_for_update().first_or_404()

    if paper.primary_author_id != user_id:
        user = db.session.get(User, user_id)
        if user.role != "admin":
            return jsonify({"message": "You can only delete your own papers."}), 403

    old_key = paper.pdf_url
    db.session.delete(paper)
    commit_files(obsolete=[old_key])

    return jsonify({"message": "Paper deleted successfully."}), 200


@papers_bp.route("/<int:paper_id>/bookmark", methods=["POST"])
@jwt_required()
def toggle_bookmark(paper_id):
    user_id = int(get_jwt_identity())
    paper = db.get_or_404(Paper, paper_id)
    require_content_access(paper, paper.primary_author_id)

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
    paper = db.get_or_404(Paper, paper_id)
    require_content_access(paper, paper.primary_author_id)
    bookmark = Bookmark.query.filter_by(user_id=user_id, paper_id=paper_id).first()
    return jsonify({"bookmarked": bookmark is not None}), 200
