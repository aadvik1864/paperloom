from flask import current_app
from extensions import db
from services.r2_storage import r2_storage


def cleanup_files(keys):
    for key in set(filter(None, keys)):
        try:
            r2_storage.delete_file(key)
        except Exception:
            current_app.logger.warning("Stored file cleanup failed; retry cleanup after storage recovers.")


def commit_files(*, uploaded=(), obsolete=()):
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        cleanup_files(uploaded)
        raise
    cleanup_files(obsolete)
