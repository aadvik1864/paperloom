import json
from datetime import datetime, timezone
from flask import current_app, has_request_context
from flask_jwt_extended import get_jwt_identity


def audit_event(action, resource, resource_id, *, actor_id=None):
    """Log committed administrative changes, never request bodies or credentials."""
    if has_request_context():
        actor_id = int(get_jwt_identity())
    current_app.logger.info(json.dumps({
        "event": "administrative_change",
        "action": action,
        "actor_id": actor_id,
        "resource": resource,
        "resource_id": resource_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }, separators=(",", ":")))
