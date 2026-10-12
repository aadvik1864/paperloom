from io import BytesIO
from pathlib import Path
from unittest.mock import Mock
import pytest
from alembic import command
from alembic.config import Config as AlembicConfig
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from botocore.exceptions import ClientError
from boto3.exceptions import S3UploadFailedError
from dotenv import dotenv_values
from flask_jwt_extended import create_access_token
from PIL import Image
from sqlalchemy import create_engine, event, inspect
from sqlalchemy.exc import SQLAlchemyError
from app import create_app
from conftest import TestConfig
from extensions import db, limiter
from models.paper import Paper
from models.user import User
from services.converter import converter
from services.r2_storage import r2_storage
from test_security import pdf_bytes


PRIVATE_MARKER = "private-connection-details-must-not-leak"


def storage_error():
    return ClientError({"Error": {"Code": "AccessDenied", "Message": PRIVATE_MARKER}}, "GetObject")


@pytest.mark.parametrize("key", ["SECRET_KEY", "JWT_SECRET_KEY"])
def test_example_secrets_are_rejected(key):
    examples = dotenv_values(Path(__file__).parents[1] / ".env.example")
    config = type("ExampleConfig", (TestConfig,), {key: examples[key]})
    with pytest.raises(ValueError, match=key):
        create_app(config)


def test_profile_throttling_normalizes_all_whitespace():
    app = create_app(type("RateConfig", (TestConfig,), {"RATELIMIT_ENABLED": True}))
    with app.app_context():
        limiter.reset()
        client = app.test_client()
        for index in range(10):
            name = "Research" + " " * (index + 1) + "Lab"
            assert client.post("/api/auth/login", json={"profile_name": name, "password": "Wrong-private-password"},
                               environ_overrides={"REMOTE_ADDR": f"198.51.100.{index + 1}"}).status_code == 401
        assert client.post("/api/auth/login", json={"profile_name": "Research\tLab", "password": "Wrong-private-password"},
                           environ_overrides={"REMOTE_ADDR": "198.51.100.100"}).status_code == 429
        db.session.remove()
        db.drop_all()


def test_last_admin_cannot_demote_themselves(client, records, headers):
    response = client.put(f"/api/admin/users/{records['admin'].id}/role", headers=headers["admin"], json={"role": "visitor"})
    assert response.status_code == 409
    assert User.query.filter_by(role="admin").count() == 1
    assert client.get("/api/auth/me", headers=headers["admin"]).status_code == 200


def test_admin_can_demote_self_only_after_promoting_successor(client, records, headers):
    assert client.put(f"/api/admin/users/{records['owner'].id}/role", headers=headers["admin"], json={"role": "admin"}).status_code == 200
    assert client.put(f"/api/admin/users/{records['admin'].id}/role", headers=headers["admin"], json={"role": "author"}).status_code == 200
    assert User.query.filter_by(role="admin").count() == 1
    assert client.get("/api/auth/me", headers=headers["admin"]).status_code == 401


def test_pdf_replacement_keeps_original_when_commit_fails(client, records, headers, monkeypatch, caplog):
    paper = records["published"]
    original = paper.pdf_url
    monkeypatch.setattr(r2_storage, "upload_file", Mock(return_value="papers/new.pdf"))
    delete = Mock()
    monkeypatch.setattr(r2_storage, "delete_file", delete)
    monkeypatch.setattr(db.session, "commit", Mock(side_effect=SQLAlchemyError(PRIVATE_MARKER)))
    response = client.put(f"/api/papers/{paper.id}", headers=headers["owner"], data={"file": (BytesIO(pdf_bytes()), "new.pdf")})
    assert response.status_code == 503
    assert db.session.get(Paper, paper.id).pdf_url == original
    delete.assert_called_once_with("papers/new.pdf")
    assert PRIVATE_MARKER not in response.text + caplog.text


def test_replacement_cleans_original_only_after_commit(client, records, headers, monkeypatch):
    paper = records["published"]
    original = paper.pdf_url
    monkeypatch.setattr(r2_storage, "upload_file", Mock(return_value="papers/new.pdf"))
    committed = []
    real_commit = db.session.commit
    def commit():
        real_commit()
        committed.append(True)
    def delete(key):
        assert committed
        assert key == original
        assert db.session.get(Paper, paper.id).pdf_url == "papers/new.pdf"
    monkeypatch.setattr(db.session, "commit", commit)
    monkeypatch.setattr(r2_storage, "delete_file", delete)
    assert client.put(f"/api/papers/{paper.id}", headers=headers["owner"], data={"file": (BytesIO(pdf_bytes()), "new.pdf")}).status_code == 200


def test_failed_create_cleans_new_upload(client, records, headers, monkeypatch):
    monkeypatch.setattr(r2_storage, "upload_file", Mock(return_value="papers/new.pdf"))
    delete = Mock()
    monkeypatch.setattr(r2_storage, "delete_file", delete)
    count = Paper.query.count()
    monkeypatch.setattr(db.session, "commit", Mock(side_effect=SQLAlchemyError(PRIVATE_MARKER)))
    response = client.post("/api/papers", headers=headers["owner"], data={
        "title": "New paper", "abstract": "Research abstract", "authors": "Author", "category_id": records["published"].category_id,
        "file": (BytesIO(pdf_bytes()), "paper.pdf"),
    })
    assert response.status_code == 503
    assert Paper.query.count() == count
    delete.assert_called_once_with("papers/new.pdf")


def test_transfer_sdk_errors_do_not_publish_or_leak_details(client, records, headers, monkeypatch, caplog):
    monkeypatch.setattr(r2_storage, "upload_file", Mock(side_effect=S3UploadFailedError(PRIVATE_MARKER)))
    count = Paper.query.count()
    response = client.post("/api/papers", headers=headers["owner"], data={
        "title": "New paper", "abstract": "Research", "authors": "Author", "category_id": records["published"].category_id,
        "file": (BytesIO(pdf_bytes()), "paper.pdf"),
    })
    assert response.status_code == 503
    assert Paper.query.count() == count
    assert PRIVATE_MARKER not in response.text + caplog.text


@pytest.mark.parametrize("admin", [False, True])
def test_delete_does_not_remove_pdf_before_commit(client, records, headers, monkeypatch, admin):
    paper_id = records["published"].id
    delete = Mock()
    monkeypatch.setattr(r2_storage, "delete_file", delete)
    monkeypatch.setattr(db.session, "commit", Mock(side_effect=SQLAlchemyError(PRIVATE_MARKER)))
    path = f"/api/admin/papers/{paper_id}/delete" if admin else f"/api/papers/{paper_id}"
    assert client.delete(path, headers=headers["admin" if admin else "owner"]).status_code == 503
    assert db.session.get(Paper, paper_id) is not None
    delete.assert_not_called()


def test_cleanup_failure_does_not_undo_saved_replacement(client, records, headers, monkeypatch, caplog):
    monkeypatch.setattr(r2_storage, "upload_file", Mock(return_value="papers/new.pdf"))
    monkeypatch.setattr(r2_storage, "delete_file", Mock(side_effect=storage_error()))
    response = client.put(f"/api/papers/{records['published'].id}", headers=headers["owner"], data={"file": (BytesIO(pdf_bytes()), "new.pdf")})
    assert response.status_code == 200
    assert records["published"].pdf_url == "papers/new.pdf"
    assert "cleanup failed" in caplog.text
    assert PRIVATE_MARKER not in response.text + caplog.text


@pytest.mark.parametrize("suffix", ["pdf", "download"])
def test_storage_sdk_errors_are_safe(client, records, monkeypatch, caplog, suffix):
    monkeypatch.setattr(r2_storage, "client", Mock())
    monkeypatch.setattr(r2_storage, "download_file", Mock(side_effect=storage_error()))
    response = client.get(f"/api/papers/{records['published'].id}/{suffix}")
    assert response.status_code == 503
    assert PRIVATE_MARKER not in response.text + caplog.text


@pytest.mark.parametrize("field", ["title", "abstract", "authors"])
def test_paper_updates_cannot_blank_required_metadata(client, records, headers, field):
    paper = records["published"]
    original = getattr(paper, field)
    assert client.put(f"/api/papers/{paper.id}", headers=headers["owner"], json={field: "  "}).status_code == 400
    db.session.rollback()
    assert getattr(paper, field) == original


def test_blog_update_cannot_blank_content(client, records, headers):
    assert client.put(f"/api/blogs/{records['public_blog'].id}", headers=headers["owner"], json={"content": " "}).status_code == 400


def test_health_checks_database_without_leaking_errors(client, monkeypatch, caplog):
    monkeypatch.setattr(db.session, "execute", Mock(side_effect=SQLAlchemyError(PRIVATE_MARKER)))
    response = client.get("/health")
    assert response.status_code == 503
    assert response.json["status"] == "unavailable"
    assert client.get("/live").status_code == 200
    assert PRIVATE_MARKER not in response.text + caplog.text


def test_health_checks_redis(client, app, monkeypatch):
    app.config["RATELIMIT_STORAGE_URI"] = "rediss://redis.invalid:6379"
    redis = Mock()
    redis.__enter__ = Mock(return_value=redis)
    redis.__exit__ = Mock(return_value=False)
    redis.ping.side_effect = RuntimeError(PRIVATE_MARKER)
    monkeypatch.setattr("app.Redis.from_url", Mock(return_value=redis))
    response = client.get("/health")
    assert response.status_code == 503
    assert PRIVATE_MARKER not in response.text


@pytest.mark.parametrize("path", [
    "/api/users/99999999999999999999999", "/api/papers/99999999999999999999999", "/api/blogs/99999999999999999999999",
    "/api/blogs/²", "/api/papers/0",
])
def test_oversized_path_ids_do_not_raise(client, path):
    assert client.get(path).status_code == 404


@pytest.mark.parametrize("query", ["page=9999999999999999999999", "page=-1", "page=no", "per_page=0", "author_id=999999999999999999999", "category_id=0", "page=1&page=2"])
def test_invalid_query_numbers_are_rejected(client, query):
    assert client.get("/api/papers?" + query).status_code == 400


def test_avatar_proxy_returns_reencoded_image_and_hides_storage_key(client, records, headers, monkeypatch):
    image = BytesIO()
    Image.new("RGB", (12, 12)).save(image, format="PNG")
    monkeypatch.setattr(r2_storage, "upload_file", Mock(return_value="avatars/private-key.jpg"))
    response = client.put("/api/users/profile", headers=headers["owner"], data={"profile_photo": (BytesIO(image.getvalue()), "photo.png")})
    assert response.status_code == 200
    avatar_url = response.json["user"]["profile_photo_url"]
    assert avatar_url == f"/api/users/{records['owner'].id}/avatar"
    assert "private-key" not in response.text
    monkeypatch.setattr(r2_storage, "download_file", Mock(return_value=image.getvalue()))
    response = client.get(avatar_url)
    assert response.status_code == 200
    assert response.mimetype == "image/jpeg"
    assert response.data.startswith(b"\xff\xd8")
    assert response.headers["Cache-Control"] == "no-store"


def test_office_capabilities_fail_closed(client, monkeypatch):
    monkeypatch.setattr(converter, "available", Mock(return_value=False))
    assert client.get("/api/papers/capabilities").json == {"office_conversion": False, "extensions": [".pdf"]}
    from werkzeug.datastructures import FileStorage
    with pytest.raises(RuntimeError, match="unavailable"):
        converter.convert_to_pdf(FileStorage(stream=BytesIO(b"{\\rtf1 Text}"), filename="input.rtf"))


def test_view_counter_uses_atomic_sql(client, records):
    statements = []
    def capture(conn, cursor, statement, parameters, context, executemany):
        statements.append(statement)
    event.listen(db.engine, "before_cursor_execute", capture)
    try:
        assert client.get(f"/api/papers/{records['published'].id}").status_code == 200
    finally:
        event.remove(db.engine, "before_cursor_execute", capture)
    assert any("SET view_count=(papers.view_count +" in statement for statement in statements)


def test_huge_signed_identity_is_rejected_before_query(client):
    token = create_access_token(identity="9" * 100, additional_claims={"auth_version": "invalid"})
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_baseline_migration_matches_models_and_is_idempotent(tmp_path):
    engine = create_engine("sqlite:///" + str(tmp_path / "migrations.db"))
    config = AlembicConfig(str(Path(__file__).parents[1] / "alembic.ini"))
    with engine.begin() as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "head")
        command.upgrade(config, "head")
        assert set(db.metadata.tables).issubset(inspect(connection).get_table_names())
        assert compare_metadata(MigrationContext.configure(connection), db.metadata) == []
    engine.dispose()
