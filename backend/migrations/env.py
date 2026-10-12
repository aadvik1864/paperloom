from alembic import context
from sqlalchemy import create_engine, pool
from config import Config
from extensions import db
import models  # noqa: F401

config = context.config
target_metadata = db.metadata


def run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


if context.is_offline_mode():
    context.configure(url=Config.SQLALCHEMY_DATABASE_URI, target_metadata=target_metadata,
                      literal_binds=True, dialect_opts={"paramstyle": "named"})
    with context.begin_transaction():
        context.run_migrations()
elif config.attributes.get("connection") is not None:
    run_migrations(config.attributes["connection"])
else:
    engine = create_engine(Config.SQLALCHEMY_DATABASE_URI, poolclass=pool.NullPool, hide_parameters=True)
    try:
        with engine.connect() as connection:
            run_migrations(connection)
    finally:
        engine.dispose()
