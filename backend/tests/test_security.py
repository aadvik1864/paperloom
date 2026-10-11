from datetime import timedelta
from io import BytesIO
from unittest.mock import Mock
import bcrypt
import pytest
from flask_jwt_extended import create_access_token, decode_token
from pypdf import PdfWriter
from pypdf.generic import DictionaryObject, NameObject, TextStringObject
from werkzeug.datastructures import FileStorage
from PIL import Image
from app import create_app
from extensions import db, limiter
from models.user import User
from models.interactions import Bookmark
from services.r2_storage import r2_storage
from services.converter import converter, validate_avatar
from utils.security import auth_version
from conftest import TestConfig


def pdf_bytes(script=False, encrypted=False, attachment=False):
    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    if script:
        writer.add_js("app.alert('unsafe');")
    if encrypted:
        writer.encrypt("secret")
    if attachment:
        writer.add_attachment("unsafe.txt", b"embedded payload")
    output = BytesIO()
    writer.write(output)
    return output.getvalue()


def test_startup_never_creates_default_admin(app, capsys):
    assert User.query.count() == 0
    assert "password:" not in capsys.readouterr().out


@pytest.mark.parametrize("key,value", [("SECRET_KEY", None), ("JWT_SECRET_KEY", "jwt-secret-key-change-in-prod"), ("SECRET_KEY", "change-this-to-a-long-but-public-placeholder")])
def test_missing_or_placeholder_secrets_fail_closed(key, value):
    config = type("UnsafeConfig", (TestConfig,), {key: value})
    with pytest.raises(ValueError, match=key):
        create_app(config)


def test_production_requires_shared_rate_limit_storage():
    config = type("ProductionConfig", (TestConfig,), {
        "TESTING": False, "ENVIRONMENT": "production",
        "SQLALCHEMY_DATABASE_URI": "postgresql+psycopg2://user:pass@db.example/paperloom",
        "CORS_ORIGINS": ["https://paperloom.example"],
    })
    with pytest.raises(ValueError, match="Redis"):
        create_app(config)


def test_production_requires_explicit_https_origins():
    config = type("ProductionConfig", (TestConfig,), {
        "TESTING": False, "ENVIRONMENT": "production",
        "SQLALCHEMY_DATABASE_URI": "postgresql+psycopg2://user:pass@db.example/paperloom",
        "RATELIMIT_STORAGE_URI": "redis://localhost:6379",
    })
    with pytest.raises(ValueError, match="CORS_ORIGINS"):
        create_app(config)


@pytest.mark.parametrize("origin", ["http://paperloom.example", "https://", "https://paperloom.example/path", "https://*.example.com"])
def test_production_rejects_invalid_cors_origins(origin):
    config = type("ProductionConfig", (TestConfig,), {
        "TESTING": False, "ENVIRONMENT": "production",
        "SQLALCHEMY_DATABASE_URI": "postgresql+psycopg2://user:pass@db.example/paperloom",
        "RATELIMIT_STORAGE_URI": "rediss://redis.example:6379/0",
        "CORS_ORIGINS": [origin],
    })
    with pytest.raises(ValueError, match="CORS_ORIGINS"):
        create_app(config)


def test_production_rejects_sqlite():
    config = type("ProductionConfig", (TestConfig,), {
        "TESTING": False, "ENVIRONMENT": "production",
        "RATELIMIT_STORAGE_URI": "redis://localhost:6379",
        "CORS_ORIGINS": ["https://paperloom.example"],
    })
    with pytest.raises(ValueError, match="PostgreSQL"):
        create_app(config)


def test_secrets_must_be_distinct():
    config = type("SameSecrets", (TestConfig,), {"JWT_SECRET_KEY": TestConfig.SECRET_KEY})
    with pytest.raises(ValueError, match="must be different"):
        create_app(config)


def test_explicit_admin_seed_does_not_log_credentials(capsys, caplog):
    config = type("SeedConfig", (TestConfig,), {"ADMIN_PASSWORD": "An-explicit-private-passphrase"})
    app = create_app(config)
    with app.app_context():
        admin = User.query.one()
        assert admin.role == "admin"
        assert admin.check_password(config.ADMIN_PASSWORD)
        db.drop_all()
    assert config.ADMIN_PASSWORD not in caplog.text + capsys.readouterr().out


def test_bootstrap_command_resets_admin_and_old_tokens(client, records, headers, app):
    result = app.test_cli_runner().invoke(args=["bootstrap-admin", "--profile", "admin"], input="A-new-private-password\nA-new-private-password\n")
    assert result.exit_code == 0
    assert client.get("/api/auth/me", headers=headers["admin"]).status_code == 401
    assert records["admin"].check_password("A-new-private-password")


def test_login_claims_and_short_lifetime(client, records):
    response = client.post("/api/auth/login", json={"profile_name": "owner", "password": "Safe-test-password-2026"})
    assert response.status_code == 200
    claims = decode_token(response.json["token"])
    assert claims["auth_version"] == auth_version(records["owner"])
    assert claims["exp"] - claims["iat"] == 3600
    assert "password_hash" not in response.json["user"]


@pytest.mark.parametrize("data", [[], {"profile_name": 12, "password": []}, {"profile_name": "owner", "password": "x"}])
def test_malformed_login_is_not_a_server_error(client, records, data):
    assert client.post("/api/auth/login", json=data).status_code in {400, 401}


def test_legacy_weak_password_cannot_login(client, records):
    records["admin"].password_hash = bcrypt.hashpw(b"weak", bcrypt.gensalt()).decode()
    db.session.commit()
    assert client.post("/api/auth/login", json={"profile_name": "admin", "password": "weak"}).status_code == 401


def test_password_reset_revokes_existing_sessions(client, records, headers):
    assert client.put(f"/api/admin/users/{records['owner'].id}/password", headers=headers["admin"], json={"password": "A-new-private-password"}).status_code == 200
    assert client.get("/api/auth/me", headers=headers["owner"]).status_code == 401


def test_role_change_and_deleted_user_revoke_sessions(client, records, headers):
    assert client.put(f"/api/admin/users/{records['owner'].id}/role", headers=headers["admin"], json={"role": "visitor"}).status_code == 200
    assert client.get("/api/auth/me", headers=headers["owner"]).status_code == 401
    assert client.delete(f"/api/admin/users/{records['other'].id}", headers=headers["admin"]).status_code == 200
    assert client.get("/api/auth/me", headers=headers["other"]).status_code == 401


def test_legacy_and_expired_tokens_are_rejected(client, records):
    legacy = create_access_token(identity=str(records["admin"].id))
    expired = create_access_token(identity=str(records["admin"].id), additional_claims={"auth_version": auth_version(records["admin"])}, expires_delta=timedelta(seconds=-1))
    for token in (legacy, expired):
        assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


@pytest.mark.parametrize("password", ["short", "a" * 73, "🧵" * 20, None, [1, 2]])
def test_admin_password_policy(client, records, headers, password):
    assert client.post("/api/admin/users", headers=headers["admin"], json={"profile_name": "new-user", "password": password}).status_code == 400


def test_login_rate_limit_and_retry_header():
    config = type("RateConfig", (TestConfig,), {"RATELIMIT_ENABLED": True})
    app = create_app(config)
    with app.app_context():
        limiter.reset()
        client = app.test_client()
        for _ in range(5):
            assert client.post("/api/auth/login", json={"profile_name": "absent", "password": "A-long-wrong-password"}).status_code == 401
        response = client.post("/api/auth/login", json={"profile_name": "absent", "password": "A-long-wrong-password"})
        assert response.status_code == 429
        assert int(response.headers["Retry-After"]) > 0
        # Forged forwarded addresses must not bypass the default proxy policy.
        assert client.post("/api/auth/login", json={"profile_name": "absent", "password": "A-long-wrong-password"}, headers={"X-Forwarded-For": "198.51.100.2"}).status_code == 429
        db.drop_all()


@pytest.mark.parametrize("path", ["/api/blogs?status=draft", "/api/blogs?status=removed", "/api/blogs?status=all", "/api/papers?status=removed", "/api/papers?status=all"])
def test_private_lists_require_login(client, records, path):
    assert client.get(path).status_code == 401


@pytest.mark.parametrize("kind", ["papers", "blogs"])
def test_profile_private_lists_cannot_leak(client, records, headers, kind):
    path = f"/api/users/{records['owner'].id}/{kind}?status=all"
    assert client.get(path).status_code == 401
    assert client.get(path, headers=headers["other"]).json[kind] == []
    assert len(client.get(path, headers=headers["owner"]).json[kind]) >= 2


@pytest.mark.parametrize("suffix", ["", "/pdf", "/download", "/citations", "/bookmark"])
def test_removed_paper_routes_enforce_owner_or_admin(client, records, headers, suffix, monkeypatch):
    path = f"/api/papers/{records['removed'].id}{suffix}"
    monkeypatch.setattr(r2_storage, "client", Mock())
    monkeypatch.setattr(r2_storage, "download_file", Mock(return_value=pdf_bytes()))
    assert client.get(path).status_code == (401 if suffix == "/bookmark" else 404)
    assert client.get(path, headers=headers["other"]).status_code == 404
    assert client.get(path, headers=headers["reader"]).status_code == 404
    for role in ("owner", "admin"):
        assert client.get(path, headers=headers[role]).status_code == 200


@pytest.mark.parametrize("kind", ["draft", "removed_blog"])
def test_private_blog_cannot_be_read_by_id_or_slug(client, records, headers, kind):
    blog = records[kind]
    for identifier in (blog.id, blog.slug):
        path = f"/api/blogs/{identifier}"
        assert client.get(path).status_code == 404
        assert client.get(path, headers=headers["other"]).status_code == 404
        assert client.get(path, headers=headers["owner"]).status_code == 200
        assert client.get(path, headers=headers["admin"]).status_code == 200


def test_published_lists_remain_public_and_do_not_expose_keys(client, records):
    for kind in ("papers", "blogs"):
        response = client.get(f"/api/{kind}")
        assert response.status_code == 200
        assert response.json["total"] == 1
        assert all(item["status"] == "published" for item in response.json[kind])
    assert client.get("/api/papers").json["papers"][0]["pdf_url"].startswith("/api/papers/")
    assert "papers/public.pdf" not in client.get(f"/api/papers/{records['published'].id}").text


def test_download_is_private_proxy_not_signed_url(client, records, monkeypatch):
    monkeypatch.setattr(r2_storage, "client", Mock())
    monkeypatch.setattr(r2_storage, "download_file", Mock(return_value=pdf_bytes()))
    response = client.get(f"/api/papers/{records['published'].id}/download")
    assert response.status_code == 200
    assert response.mimetype == "application/pdf"
    assert response.headers["Content-Disposition"].startswith("attachment;")
    assert response.headers["Cache-Control"] == "no-store"
    assert records["published"].download_count == 1


def test_removed_bookmarks_are_filtered(client, records, headers):
    db.session.add(Bookmark(user_id=records["reader"].id, paper_id=records["removed"].id))
    db.session.commit()
    assert client.get("/api/users/bookmarks", headers=headers["reader"]).json["bookmarks"] == []
    assert client.post(f"/api/papers/{records['removed'].id}/bookmark", headers=headers["reader"]).status_code == 404


def test_comments_validate_body_and_private_content(client, records, headers):
    path = f"/api/blogs/{records['public_blog'].id}/comments"
    assert client.post(path, headers=headers["reader"], json={"content": " "}).status_code == 400
    assert client.post(path, headers=headers["reader"], json={"content": "x" * 5001}).status_code == 400
    assert client.post(f"/api/blogs/{records['draft'].id}/comments", headers=headers["reader"], json={"content": "Not allowed"}).status_code == 404
    assert client.post(path, headers=headers["reader"], json={"content": "A useful comment"}).status_code == 201


@pytest.mark.parametrize("payload", [{"website": "javascript:alert(1)"}, {"website": "https://user:pass@example.com"}, {"website": "http://[invalid"}, {"profile_name": ""}, {"profile_name": "owner"}, {"bio": []}])
def test_profile_validation(client, records, headers, payload):
    assert client.put("/api/users/profile", headers=headers["reader"], json=payload).status_code == 400


def test_profile_cannot_self_promote(client, records, headers):
    assert client.put("/api/users/profile", headers=headers["reader"], json={"role": "admin"}).status_code == 200
    assert records["reader"].role == "visitor"
    assert client.get("/api/admin/users", headers=headers["reader"]).status_code == 403


def test_multipart_avatar_is_validated_and_reencoded(client, records, headers, monkeypatch):
    image = BytesIO()
    Image.new("RGB", (50, 50), "navy").save(image, format="PNG")
    image.seek(0)
    upload = Mock(return_value="avatars/safe.jpg")
    monkeypatch.setattr(r2_storage, "upload_file", upload)
    response = client.put("/api/users/profile", headers=headers["reader"], data={"bio": "Updated bio", "profile_photo": (image, "photo.png")})
    assert response.status_code == 200
    assert response.json["user"]["bio"] == "Updated bio"
    uploaded = upload.call_args.args[0]
    assert uploaded.content_type == "image/jpeg"
    assert uploaded.read().startswith(b"\xff\xd8")
    bad = client.put("/api/users/profile", headers=headers["reader"], data={"profile_photo": (BytesIO(b"<svg onload='alert(1)'>"), "photo.svg")})
    assert bad.status_code == 400


def test_upload_request_size_cap(client, records, headers, app):
    app.config["MAX_CONTENT_LENGTH"] = 1024
    response = client.post("/api/papers", headers=headers["owner"], data={"file": (BytesIO(b"x" * 2000), "paper.pdf")})
    assert response.status_code == 413


def test_valid_pdf_is_accepted(app):
    converted = converter.convert_to_pdf(FileStorage(stream=BytesIO(pdf_bytes()), filename="paper.pdf"))
    assert converted.mimetype == "application/pdf"
    assert converted.read().startswith(b"%PDF-")


@pytest.mark.parametrize("data,filename", [(b"<script>alert(1)</script>", "paper.pdf"), (b"not a zip", "paper.docx"), (b"not a document", "paper.doc"), (b"not RTF", "paper.rtf"), (b"anything", "paper.exe"), (b"", "paper.pdf")])
def test_extension_spoofing_is_rejected(app, data, filename):
    with pytest.raises(ValueError):
        converter.convert_to_pdf(FileStorage(stream=BytesIO(data), filename=filename))


@pytest.mark.parametrize("option", ["script", "encrypted", "attachment"])
def test_active_and_encrypted_pdfs_are_rejected(app, option):
    with pytest.raises(ValueError):
        converter.convert_to_pdf(FileStorage(stream=BytesIO(pdf_bytes(**{option: True})), filename="paper.pdf"))


def test_automatic_pdf_actions_are_rejected(app):
    writer = PdfWriter()
    writer.add_blank_page(width=100, height=100)
    writer._root_object.update({NameObject("/OpenAction"): DictionaryObject({NameObject("/S"): NameObject("/URI"), NameObject("/URI"): TextStringObject("https://example.com")})})
    output = BytesIO()
    writer.write(output)
    with pytest.raises(ValueError):
        converter.convert_to_pdf(FileStorage(stream=BytesIO(output.getvalue()), filename="paper.pdf"))


def test_file_and_avatar_size_caps(app):
    app.config["MAX_FILE_BYTES"] = 32
    app.config["MAX_AVATAR_BYTES"] = 32
    with pytest.raises(ValueError):
        converter.convert_to_pdf(FileStorage(stream=BytesIO(b"x" * 33), filename="paper.pdf"))
    with pytest.raises(ValueError):
        validate_avatar(FileStorage(stream=BytesIO(b"x" * 33), filename="photo.png"))


def test_office_conversion_fails_closed_without_sandbox(app, monkeypatch):
    monkeypatch.setattr("services.converter.shutil.which", lambda tool: None if tool == "bwrap" else "/usr/bin/" + tool)
    with pytest.raises(RuntimeError, match="Upload a PDF"):
        converter.convert_to_pdf(FileStorage(stream=BytesIO(b"{\\rtf1 Safe content}"), filename="paper.rtf"))


def test_security_headers_and_explicit_cors(client):
    trusted = client.get("/api/papers/categories", headers={"Origin": "http://localhost:5173"})
    assert trusted.headers["Access-Control-Allow-Origin"] == "http://localhost:5173"
    assert trusted.headers["X-Content-Type-Options"] == "nosniff"
    assert trusted.headers["Cache-Control"] == "no-store"
    untrusted = client.get("/api/papers/categories", headers={"Origin": "https://attacker.example"})
    assert "Access-Control-Allow-Origin" not in untrusted.headers
    secure = client.get("/health", base_url="https://paperloom.example")
    assert "max-age" in secure.headers["Strict-Transport-Security"]
