"""Authenticated smoke checks restricted to a disposable local application."""
import argparse
from http.cookiejar import CookieJar
import json
import os
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import HTTPCookieProcessor, HTTPRedirectHandler, Request, build_opener


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def check(origin, password):
    parsed = urlsplit(origin)
    if (parsed.scheme != 'http' or parsed.hostname not in {'127.0.0.1', 'localhost'} or
            parsed.username or parsed.password or parsed.path not in {'', '/'} or parsed.query or parsed.fragment):
        raise ValueError('Session smoke checks require a disposable localhost HTTP origin.')
    origin = origin.rstrip('/')
    jar = CookieJar()
    opener = build_opener(NoRedirect(), HTTPCookieProcessor(jar))

    def request(path, method='GET', data=None, headers=None, expected=200):
        options = {'X-Paperloom-Session': 'cookie', 'Origin': origin, **(headers or {})}
        if data is not None:
            options['Content-Type'] = 'application/json'
        req = Request(origin + path, method=method, headers=options,
                      data=json.dumps(data).encode() if data is not None else None)
        try:
            response = opener.open(req, timeout=10)
        except HTTPError as error:
            response = error
        with response:
            assert response.status == expected, f'{method} {path}: expected {expected}, got {response.status}'
            return json.load(response)

    credentials = {'profile_name': 'Smoke Author', 'password': password}
    response = request('/api/auth/login', 'POST', credentials)
    assert 'token' not in response, 'Cookie login exposed a bearer token.'
    cookies = {cookie.name: cookie for cookie in jar}
    access, csrf = cookies['paperloom_access'], cookies['paperloom_csrf']
    assert access.has_nonstandard_attr('HttpOnly') and not csrf.has_nonstandard_attr('HttpOnly')
    assert access.get_nonstandard_attr('SameSite') == 'Lax'
    assert access.expires is not None
    token = access.value
    request('/api/auth/me')
    request('/api/users/profile', 'PUT', {'bio': 'Forged'}, expected=403)
    request('/api/users/profile', 'PUT', {'bio': 'Forged'}, {'X-CSRF-TOKEN': 'wrong'}, expected=403)
    request('/api/users/profile', 'PUT', {'bio': 'Local session smoke'}, {'X-CSRF-TOKEN': csrf.value})
    request('/api/auth/login', 'POST', credentials, {'Origin': 'https://attacker.example'}, expected=403)
    request('/api/auth/logout', 'POST', {}, {'X-CSRF-TOKEN': csrf.value})
    assert not list(jar), 'Logout did not clear the session cookies.'
    request('/api/auth/me', headers={'Authorization': 'Bearer ' + token}, expected=401)
    request('/api/auth/me', expected=401)
    print('PASS: HttpOnly login, CSRF rejection, authenticated update, cookie clearing and copied-token revocation.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--origin', required=True)
    args = parser.parse_args()
    password = os.getenv('PAPERLOOM_SMOKE_PASSWORD')
    if not password:
        parser.error('Set PAPERLOOM_SMOKE_PASSWORD for the synthetic Smoke Author profile.')
    try:
        check(args.origin, password)
    except (AssertionError, ValueError, OSError):
        print('FAIL: local cookie-session smoke check; review local service configuration.')
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
