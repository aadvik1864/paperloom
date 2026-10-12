import os
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Barrier
from urllib.parse import urlsplit
import pytest
from alembic import command
from alembic.config import Config as AlembicConfig
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from flask_jwt_extended import create_access_token
from sqlalchemy import event
from app import create_app
from conftest import TestConfig
from extensions import db
from models.user import User
from models.paper import Paper, Category
from utils.security import auth_version


@pytest.fixture
def pg_app():
    url = os.getenv("PAPERLOOM_TEST_POSTGRES_URL")
    if not url:
        pytest.skip("Set PAPERLOOM_TEST_POSTGRES_URL to a disposable local PostgreSQL database.")
    parsed = urlsplit(url)
    if parsed.hostname not in {"localhost", "127.0.0.1"} or not parsed.path.startswith("/paperloom_test"):
        pytest.fail("PostgreSQL integration tests require a disposable local paperloom_test database.")
    app = create_app(type("PostgresConfig", (TestConfig,), {"SQLALCHEMY_DATABASE_URI": url}))
    with app.app_context():
        yield app
        db.session.remove()
        db.drop_all()
        with db.engine.begin() as connection:
            connection.execute(db.text("DROP TABLE IF EXISTS alembic_version"))
        db.engine.dispose()


def test_postgres_simultaneous_demotions_preserve_an_admin(pg_app):
    tokens = []
    for index in range(2):
        user = User(profile_name=f"Admin {index}", role="admin")
        user.set_password("Private-integration-test-password")
        db.session.add(user)
        db.session.flush()
        tokens.append((user.id, create_access_token(identity=str(user.id), additional_claims={"auth_version": auth_version(user)})))
    db.session.commit()
    barrier = Barrier(2)
    def demote(item):
        user_id, token = item
        with pg_app.test_client() as client:
            barrier.wait(timeout=10)
            return client.put(f"/api/admin/users/{user_id}/role", headers={"Authorization": f"Bearer {token}"}, json={"role": "visitor"}).status_code
    with ThreadPoolExecutor(max_workers=2) as executor:
        statuses = list(executor.map(demote, tokens))
    db.session.expire_all()
    assert sorted(statuses) == [200, 409]
    assert User.query.filter_by(role="admin").count() == 1


def test_postgres_simultaneous_views_are_not_lost(pg_app):
    user = User(profile_name="Researcher", role="author")
    user.set_password("Private-integration-test-password")
    db.session.add(user)
    db.session.flush()
    paper = Paper(title="Concurrent views", abstract="Research", authors="Researcher", primary_author_id=user.id,
                  category_id=Category.query.first().id, pdf_url="papers/test.pdf", status="published")
    db.session.add(paper)
    db.session.commit()
    paper_id = paper.id
    barrier = Barrier(2)
    def synchronize(conn, cursor, statement, parameters, context, executemany):
        if statement.startswith("UPDATE papers SET view_count="):
            barrier.wait(timeout=10)
    event.listen(db.engine, "before_cursor_execute", synchronize)
    def view(_):
        with pg_app.test_client() as client:
            return client.get(f"/api/papers/{paper_id}").status_code
    try:
        with ThreadPoolExecutor(max_workers=2) as executor:
            assert list(executor.map(view, range(2))) == [200, 200]
    finally:
        event.remove(db.engine, "before_cursor_execute", synchronize)
    db.session.expire_all()
    assert db.session.get(Paper, paper_id).view_count == 2


def test_postgres_baseline_migration_matches_models(pg_app):
    db.session.remove()
    db.drop_all()
    config = AlembicConfig(str(Path(__file__).parents[1] / "alembic.ini"))
    with db.engine.begin() as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "head")
        command.upgrade(config, "head")
        assert compare_metadata(MigrationContext.configure(connection), db.metadata) == []
