import sys
from pathlib import Path
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import create_app
from extensions import db
from models.user import User
from models.paper import Paper, Category
from models.blog import Blog
from services.sessions import issue_access_token


class TestConfig:
    TESTING = True
    ENVIRONMENT = "testing"
    SECRET_KEY = "test-flask-secret-not-for-production-123456789"
    JWT_SECRET_KEY = "test-jwt-secret-not-for-production-123456789"
    JWT_COOKIE_SECURE = False
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    RATELIMIT_ENABLED = False
    RATELIMIT_STORAGE_URI = "memory://"
    ADMIN_PASSWORD = None
    R2_ACCOUNT_ID = None
    R2_ACCESS_KEY_ID = None
    R2_SECRET_ACCESS_KEY = None
    R2_BUCKET_NAME = None
    CORS_ORIGINS = ["http://localhost:5173"]
    PROXY_HOPS = 0


@pytest.fixture
def app():
    app = create_app(TestConfig)
    with app.app_context():
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def records(app):
    users = {}
    for name, role in (("admin", "admin"), ("owner", "author"), ("other", "author"), ("reader", "visitor")):
        user = User(profile_name=name, role=role)
        user.set_password("Safe-test-password-2026")
        db.session.add(user)
        users[name] = user
    db.session.flush()
    category = Category.query.first()
    published = Paper(title="Published paper", abstract="Public abstract", authors="Owner", category_id=category.id,
                      primary_author_id=users["owner"].id, pdf_url="papers/public.pdf", status="published")
    removed = Paper(title="Removed paper", abstract="Private abstract", authors="Owner", category_id=category.id,
                    primary_author_id=users["owner"].id, pdf_url="papers/private.pdf", status="removed")
    public_blog = Blog(title="Public blog", slug="public-blog", content="Public post", author_id=users["owner"].id, status="published")
    draft = Blog(title="Secret draft", slug="secret-draft", content="Private post", author_id=users["owner"].id, status="draft")
    removed_blog = Blog(title="Removed blog", slug="removed-blog", content="Removed post", author_id=users["owner"].id, status="removed")
    db.session.add_all([published, removed, public_blog, draft, removed_blog])
    db.session.commit()
    return {**users, "published": published, "removed": removed, "public_blog": public_blog, "draft": draft, "removed_blog": removed_blog}


@pytest.fixture
def headers(records):
    return {name: {"Authorization": f"Bearer {issue_access_token(records[name])}"}
            for name in ("admin", "owner", "other", "reader")}
