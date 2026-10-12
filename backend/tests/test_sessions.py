import os
import time
from unittest.mock import Mock
from urllib.parse import urlsplit
from uuid import uuid4
import pytest
from flask_jwt_extended import create_access_token
from redis.exceptions import ConnectionError
from services.sessions import SessionStore, SessionStoreUnavailable, session_store
from utils.security import auth_version


def login(client):
    response = client.post('/api/auth/login', json={"profile_name": "owner", "password": "Safe-test-password-2026"})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json['token']}"}


def test_logout_revokes_copied_token_only(client, records):
    first, second = login(client), login(client)
    assert client.get('/api/auth/me', headers=first).status_code == 200
    assert client.post('/api/auth/logout', headers=first).status_code == 200
    assert client.get('/api/auth/me', headers=first).status_code == 401
    assert client.post('/api/auth/logout', headers=first).status_code == 401
    assert client.get('/api/auth/me', headers=second).status_code == 200
    assert client.post('/api/auth/logout').status_code == 401


def test_unregistered_signed_token_is_rejected(client, records):
    token = create_access_token(identity=str(records['owner'].id), additional_claims={"auth_version": auth_version(records['owner'])})
    assert client.get('/api/auth/me', headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_lost_session_registry_does_not_restore_access(client, records, app):
    headers = login(client)
    app.extensions['paperloom_sessions'] = SessionStore('memory://')
    assert client.get('/api/auth/me', headers=headers).status_code == 401


@pytest.mark.parametrize('operation', ['register', 'active', 'revoke'])
def test_store_errors_are_sanitized(client, records, headers, monkeypatch, caplog, operation):
    store = session_store()
    redis = Mock()
    redis.set.side_effect = ConnectionError('private-redis-password')
    redis.get.side_effect = ConnectionError('private-redis-password')
    redis.mget.side_effect = ConnectionError('private-redis-password')
    redis.delete.side_effect = ConnectionError('private-redis-password')
    if operation == 'revoke':
        redis.mget.return_value = [str(records['owner'].id).encode() + b':' + b'a' * 32, b'a' * 32]
        redis.mget.side_effect = None
    monkeypatch.setattr(store, 'redis', redis)
    if operation == 'register':
        response = client.post('/api/auth/login', json={"profile_name": "owner", "password": "Safe-test-password-2026"})
        assert 'token' not in response.json
    elif operation == 'active':
        response = client.get('/api/auth/me', headers=headers['owner'])
    else:
        response = client.post('/api/auth/logout', headers=headers['owner'])
    assert response.status_code == 503
    assert 'private-redis-password' not in response.text + caplog.text


def test_failed_registration_never_returns_token(client, records, monkeypatch):
    monkeypatch.setattr(session_store(), 'register', Mock(side_effect=SessionStoreUnavailable()))
    response = client.post('/api/auth/login', json={"profile_name": "owner", "password": "Safe-test-password-2026"})
    assert response.status_code == 503
    assert 'token' not in response.json


def test_rate_limiter_redis_errors_are_unavailable_not_internal_errors(client, app, caplog):
    @app.route('/simulate-redis-outage')
    def fail():
        raise ConnectionError('private-rate-limit-connection')
    response = client.get('/simulate-redis-outage')
    assert response.status_code == 503
    assert 'private-rate-limit-connection' not in response.text + caplog.text


def test_expiry_and_identity_match(monkeypatch):
    store = SessionStore('memory://')
    payload = {'jti': str(uuid4()), 'sub': '42', 'exp': time.time() + 60}
    store.register(payload)
    assert store.active(payload)
    assert not store.active({**payload, 'sub': '43'})
    assert not store.active({**payload, 'jti': None})
    monkeypatch.setattr('services.sessions.time.time', lambda: payload['exp'] + 1)
    assert not store.active(payload)
    with pytest.raises(ValueError):
        store.register(payload)


def test_registration_uses_expiring_redis_records():
    store = SessionStore('memory://')
    store.redis = Mock()
    store.redis.get.return_value = b'a' * 32
    payload = {'jti': str(uuid4()), 'sub': '42', 'exp': int(time.time()) + 3600}
    store.register(payload)
    args, kwargs = store.redis.set.call_args
    assert args == (store.key(payload), b'42:' + b'a' * 32)
    assert 3598 <= kwargs['ex'] <= 3600
    assert payload['jti'] not in args[0]


def test_real_redis_shared_sessions_and_logout():
    url = os.getenv('PAPERLOOM_TEST_REDIS_URL')
    if not url:
        pytest.skip('Set PAPERLOOM_TEST_REDIS_URL to disposable local Redis database 15.')
    parsed = urlsplit(url)
    if parsed.hostname not in {'localhost', '127.0.0.1'} or parsed.path != '/15':
        pytest.fail('Redis integration tests require disposable local database 15.')
    first, second = SessionStore(url), SessionStore(url)
    payload = {'jti': str(uuid4()), 'sub': str(uuid4().int), 'exp': int(time.time()) + 60}
    try:
        first.register(payload)
        assert second.active(payload)
        assert 0 < second.redis.ttl(first.key(payload)) <= 60
        second.revoke_user(payload['sub'])
        assert not first.active(payload)
        first.register(payload)
        assert second.active(payload)
        second.revoke(payload)
        assert not first.active(payload)
        assert not second.active(payload)
    finally:
        first.revoke(payload)
        first.redis.delete(first.epoch_key(payload['sub']))
        first.redis.close()
        second.redis.close()


def test_role_reversal_never_restores_an_old_token(client, records, headers):
    target = records['owner'].id
    assert client.put(f'/api/admin/users/{target}/role', headers=headers['admin'], json={'role': 'visitor'}).status_code == 200
    assert client.put(f'/api/admin/users/{target}/role', headers=headers['admin'], json={'role': 'author'}).status_code == 200
    assert client.get('/api/auth/me', headers=headers['owner']).status_code == 401
    assert client.get('/api/auth/me', headers=login(client)).status_code == 200


def test_failed_profile_revocation_cannot_commit_role_change(client, records, headers, monkeypatch):
    target = records['owner'].id
    monkeypatch.setattr(session_store(), 'revoke_user', Mock(side_effect=SessionStoreUnavailable()))
    response = client.put(f'/api/admin/users/{target}/role', headers=headers['admin'], json={'role': 'visitor'})
    assert response.status_code == 503
    assert records['owner'].role == 'author'
    assert client.get('/api/auth/me', headers=headers['owner']).status_code == 200


@pytest.mark.parametrize('revision', ['a' * 40, 'unknown', 'private-connection-string'])
def test_version_endpoint_is_uncached_and_sanitized(client, app, revision):
    app.config['APP_REVISION'] = revision
    response = client.get('/version')
    assert response.json == {'service': 'paperloom', 'revision': revision if revision == 'a' * 40 else 'unknown'}
    assert response.headers['Cache-Control'] == 'no-store'
