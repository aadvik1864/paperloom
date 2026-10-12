from unittest.mock import Mock
import pytest
from flask_jwt_extended import decode_token
from services.sessions import session_store, SessionStoreUnavailable


COOKIE_HEADERS = {'X-Paperloom-Session': 'cookie', 'Origin': 'http://localhost'}
LOGIN = {'profile_name': 'owner', 'password': 'Safe-test-password-2026'}


def cookie_login(client):
    response = client.post('/api/auth/login', json=LOGIN, headers=COOKIE_HEADERS)
    assert response.status_code == 200
    return response


def csrf_headers(client):
    return {**COOKIE_HEADERS, 'X-CSRF-TOKEN': client.get_cookie('paperloom_csrf').value}


def test_cookie_login_hides_token_and_limits_cookie_lifetime(client, records):
    response = cookie_login(client)
    assert 'token' not in response.json
    access = client.get_cookie('paperloom_access')
    csrf = client.get_cookie('paperloom_csrf')
    assert access.http_only and not csrf.http_only
    assert access.same_site == csrf.same_site == 'Lax'
    assert access.max_age == csrf.max_age == 3600
    assert access.origin_only and csrf.origin_only
    assert decode_token(access.value)['csrf'] == csrf.value
    assert client.get('/api/auth/me', headers=COOKIE_HEADERS).status_code == 200
    assert response.headers['Cache-Control'] == 'no-store'


@pytest.mark.parametrize('method,path,payload', [
    ('POST', '/api/auth/logout', {}),
    ('PUT', '/api/users/profile', {'bio': 'Forged update'}),
    ('POST', '/api/blogs', {'title': 'Forged', 'content': 'Forged'}),
])
@pytest.mark.parametrize('csrf', [None, 'incorrect'])
def test_cookie_mutations_require_matching_csrf(client, records, method, path, payload, csrf):
    cookie_login(client)
    headers = dict(COOKIE_HEADERS)
    if csrf is not None:
        headers['X-CSRF-TOKEN'] = csrf
    response = client.open(path, method=method, json=payload, headers=headers)
    assert response.status_code == 403
    assert records['owner'].bio != 'Forged update'
    assert client.get('/api/auth/me', headers=COOKIE_HEADERS).status_code == 200


def test_cookie_csrf_works_for_json_and_multipart(client, records):
    cookie_login(client)
    headers = csrf_headers(client)
    assert client.put('/api/users/profile', json={'bio': 'JSON update'}, headers=headers).status_code == 200
    assert client.put('/api/users/profile', data={'bio': 'Multipart update'}, content_type='multipart/form-data', headers=headers).status_code == 200
    assert records['owner'].bio == 'Multipart update'


@pytest.mark.parametrize('origin', ['https://attacker.example', 'http://localhost:5173', 'null'])
def test_even_allowed_cross_origin_pages_cannot_mint_cookies(client, records, origin):
    response = client.post('/api/auth/login', json=LOGIN, headers={**COOKIE_HEADERS, 'Origin': origin})
    assert response.status_code == 403
    assert not response.headers.getlist('Set-Cookie')
    assert 'token' not in response.json


def test_cross_site_cookie_mutation_rejected_even_with_csrf(client, records):
    cookie_login(client)
    headers = {**csrf_headers(client), 'Origin': 'https://attacker.example'}
    assert client.put('/api/users/profile', json={'bio': 'Forged'}, headers=headers).status_code == 403
    headers.pop('Origin')
    headers['Sec-Fetch-Site'] = 'cross-site'
    assert client.post('/api/auth/logout', json={}, headers=headers).status_code == 403


@pytest.mark.parametrize('browser_headers', [{'Origin': 'http://localhost'}, {'Sec-Fetch-Site': 'same-origin'}])
def test_browser_login_cannot_request_readable_bearer_token(client, records, browser_headers):
    response = client.post('/api/auth/login', json=LOGIN, headers=browser_headers)
    assert response.status_code == 403
    assert 'token' not in response.json


def test_cookie_logout_clears_cookies_and_revokes_copied_token(client, records):
    cookie_login(client)
    token = client.get_cookie('paperloom_access').value
    assert client.post('/api/auth/logout', json={}, headers=csrf_headers(client)).status_code == 200
    assert client.get_cookie('paperloom_access') is None
    assert client.get_cookie('paperloom_csrf') is None
    assert client.get('/api/auth/me', headers={'Authorization': f'Bearer {token}'}).status_code == 401


def test_failed_cookie_registration_never_sets_cookies(client, records, monkeypatch):
    monkeypatch.setattr(session_store(), 'register', Mock(side_effect=SessionStoreUnavailable()))
    response = client.post('/api/auth/login', json=LOGIN, headers=COOKIE_HEADERS)
    assert response.status_code == 503
    assert not response.headers.getlist('Set-Cookie')
    assert 'token' not in response.json


def test_cookie_logout_outage_does_not_claim_revocation(client, records, monkeypatch):
    cookie_login(client)
    monkeypatch.setattr(session_store(), 'revoke', Mock(side_effect=SessionStoreUnavailable()))
    response = client.post('/api/auth/logout', json={}, headers=csrf_headers(client))
    assert response.status_code == 503
    assert client.get_cookie('paperloom_access') is not None


def test_csrf_from_older_session_cannot_revoke_newer_login(client, records):
    cookie_login(client)
    old_headers = csrf_headers(client)
    cookie_login(client)
    assert client.post('/api/auth/logout', json={}, headers=old_headers).status_code == 403
    assert client.get('/api/auth/me', headers=COOKIE_HEADERS).status_code == 200


def test_explicit_bearer_logout_does_not_clear_another_cookie_session(client, records):
    token = client.post('/api/auth/login', json=LOGIN).json['token']
    cookie_login(client)
    response = client.post('/api/auth/logout', headers={**COOKIE_HEADERS, 'Authorization': f'Bearer {token}'})
    assert response.status_code == 200
    assert not response.headers.getlist('Set-Cookie')
    assert client.get('/api/auth/me', headers=COOKIE_HEADERS).status_code == 200


def test_secure_cookie_configuration_is_respected(client, records, app):
    app.config.update(JWT_COOKIE_SECURE=True, JWT_ACCESS_COOKIE_NAME='__Host-paperloom_access',
                      JWT_ACCESS_CSRF_COOKIE_NAME='__Host-paperloom_csrf')
    response = cookie_login(client)
    for cookie in response.headers.getlist('Set-Cookie'):
        assert 'Secure' in cookie and 'Path=/' in cookie and 'Domain=' not in cookie
    assert 'HttpOnly' in response.headers.getlist('Set-Cookie')[0]
