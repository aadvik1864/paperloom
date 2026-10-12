import json
from unittest.mock import Mock
from sqlalchemy.exc import SQLAlchemyError
from extensions import db


def events(caplog):
    return [json.loads(record.message) for record in caplog.records if record.message.startswith('{"event":"administrative_change"')]


def test_password_reset_audit_excludes_credentials(client, records, headers, caplog):
    password = 'Private-reset-password-2026'
    target = records['owner'].id
    response = client.put(f'/api/admin/users/{target}/password', headers=headers['admin'], json={'password': password})
    assert response.status_code == 200
    event, = events(caplog)
    assert event['action'] == 'reset_password'
    assert event['actor_id'] == records['admin'].id
    assert event['resource_id'] == target
    assert set(event) == {'event', 'action', 'actor_id', 'resource', 'resource_id', 'timestamp'}
    assert password not in caplog.text
    assert headers['admin']['Authorization'] not in caplog.text


def test_failed_admin_change_is_not_logged_as_committed(client, records, headers, caplog, monkeypatch):
    monkeypatch.setattr(db.session, 'commit', Mock(side_effect=SQLAlchemyError('Private database failure')))
    response = client.put(f"/api/admin/users/{records['owner'].id}/role", headers=headers['admin'], json={'role': 'visitor'})
    assert response.status_code == 503
    assert events(caplog) == []


def test_denied_admin_change_is_not_logged_as_committed(client, records, headers, caplog):
    assert client.delete(f"/api/admin/users/{records['owner'].id}", headers=headers['reader']).status_code == 403
    assert events(caplog) == []


def test_cli_bootstrap_has_no_web_actor(app, caplog):
    result = app.test_cli_runner().invoke(args=['bootstrap-admin', '--profile', 'Bootstrap test'], input='Private-cli-password-2026\nPrivate-cli-password-2026\n')
    assert result.exit_code == 0
    event, = events(caplog)
    assert event['action'] == 'bootstrap_admin'
    assert event['actor_id'] is None
    assert 'Private-cli-password-2026' not in caplog.text
