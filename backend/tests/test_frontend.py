import pytest
from app import create_app
from extensions import db
from conftest import TestConfig


@pytest.fixture
def website(tmp_path):
    bundle = tmp_path / "frontend_dist"
    bundle.mkdir()
    (bundle / "index.html").write_text('<html><div id="root">Paperloom</div></html>', encoding="utf-8")
    (bundle / "assets").mkdir()
    (bundle / "assets" / "app.js").write_text('console.log("Paperloom");', encoding="utf-8")
    (tmp_path / "private.txt").write_text("private", encoding="utf-8")
    config = type("WebsiteConfig", (TestConfig,), {"FRONTEND_DIST": bundle})
    app = create_app(config)
    with app.app_context():
        yield app.test_client()
        db.session.remove()
        db.drop_all()


@pytest.mark.parametrize("path", ["/", "/papers/1", "/login", "/author/dashboard"])
def test_website_and_deep_links_load(website, path):
    response = website.get(path)
    assert response.status_code == 200
    assert response.mimetype == "text/html"
    assert 'id="root"' in response.text


def test_static_assets_keep_their_content_type(website):
    response = website.get("/assets/app.js")
    assert response.status_code == 200
    assert "javascript" in response.mimetype
    assert response.text == 'console.log("Paperloom");'


@pytest.mark.parametrize("path", ["/assets/missing.js", "/missing.pdf", "/../private.txt", "/%2e%2e/private.txt"])
def test_missing_assets_and_traversal_do_not_return_html(website, path):
    response = website.get(path)
    assert response.status_code == 404
    assert response.is_json
    assert "private" not in response.text


@pytest.mark.parametrize("path", ["/api", "/api/missing", "/api/auth/missing"])
def test_unknown_api_routes_remain_json_errors(website, path):
    response = website.get(path)
    assert response.status_code == 404
    assert response.is_json


def test_api_and_authentication_still_work(website):
    assert website.get("/health").json["status"] == "healthy"
    assert website.get("/api/papers").status_code == 200
    assert website.get("/api/auth/me").status_code == 401
