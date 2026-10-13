from datetime import UTC, datetime


def utc_now():
    """Return UTC without timezone info, matching the existing database columns."""
    return datetime.now(UTC).replace(tzinfo=None)
