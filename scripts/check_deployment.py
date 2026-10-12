"""Read-only readiness and security checks. No production account is required."""
import argparse
import json
import re
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener


class CheckFailed(RuntimeError):
    pass


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def validate_origin(origin, allow_local=False):
    try:
        parsed = urlsplit(origin)
        valid = (parsed.hostname and not parsed.username and not parsed.password and
                 parsed.path in {'', '/'} and not parsed.query and not parsed.fragment)
        parsed.port
        secure = parsed.scheme == 'https'
        local = allow_local and parsed.scheme == 'http' and parsed.hostname in {'127.0.0.1', 'localhost'}
    except ValueError:
        valid = False
        secure = local = False
    if not valid or not (secure or local):
        raise CheckFailed('Use an exact HTTPS origin, without credentials, paths or query strings.')
    return origin.rstrip('/')


def read_response(opener, url):
    try:
        try:
            response = opener.open(Request(url, headers={'User-Agent': 'Paperloom-Deployment-Check/1.0'}), timeout=45)
        except HTTPError as error:
            response = error
        with response:
            body = response.read(1024 * 1024 + 1)
            if len(body) > 1024 * 1024:
                raise CheckFailed('Response exceeded the safe check limit.')
            return response.status, response.headers, body
    except (URLError, OSError, TimeoutError):
        raise CheckFailed('Service unreachable or TLS verification failed.') from None


def check_deployment(origin, expected_revision=None, *, allow_local=False, opener=None):
    origin = validate_origin(origin, allow_local)
    if expected_revision and not re.fullmatch('[0-9a-f]{40}', expected_revision):
        raise CheckFailed('Expected revision must be a full lowercase commit hash.')
    opener = opener or build_opener(NoRedirect())
    checks = [('/', 200), ('/health', 200), ('/live', 200), ('/version', 200),
              ('/api/papers/capabilities', 200), ('/.env', 404), ('/.git/config', 404),
              ('/api/auth/me', 401), ('/api/admin/users', 401), ('/api/papers?status=all', 401)]
    results = []
    for path, expected_status in checks:
        status, headers, body = read_response(opener, origin + path)
        if status != expected_status:
            raise CheckFailed(f'{path}: expected HTTP {expected_status}, received {status}.')
        csp = headers.get('Content-Security-Policy', '')
        if "default-src 'self'" not in csp or "object-src 'none'" not in csp:
            raise CheckFailed(f'{path}: required Content Security Policy is missing.')
        if headers.get('X-Content-Type-Options') != 'nosniff':
            raise CheckFailed(f'{path}: MIME-sniffing protection is missing.')
        if origin.startswith('https://') and not re.search(r'max-age=[1-9][0-9]*', headers.get('Strict-Transport-Security', '')):
            raise CheckFailed(f'{path}: HTTPS transport protection is missing.')
        if not path.startswith('/.') and headers.get('Cache-Control') != 'no-store':
            raise CheckFailed(f'{path}: response must not be cached.')
        result = {'path': path, 'status': status}
        if path == '/' and (not headers.get('Content-Type', '').startswith('text/html') or b'<html' not in body.lower()):
            raise CheckFailed('/: bundled website is missing.')
        if path in {'/health', '/live', '/version', '/api/papers/capabilities'}:
            try:
                if not headers.get('Content-Type', '').startswith('application/json'):
                    raise ValueError()
                data = json.loads(body)
                if not isinstance(data, dict):
                    raise ValueError()
            except (ValueError, UnicodeError):
                raise CheckFailed(f'{path}: expected a JSON object.') from None
            if path in {'/health', '/live'}:
                expected = 'healthy' if path == '/health' else 'alive'
                if data != {'service': 'paperloom', 'status': expected}:
                    raise CheckFailed(f'{path}: service is not ready.')
            if path == '/version':
                revision = data.get('revision')
                if data.get('service') != 'paperloom' or not isinstance(revision, str) or not re.fullmatch(r'[0-9a-f]{40}|unknown', revision):
                    raise CheckFailed('/version: invalid release metadata.')
                if expected_revision and revision != expected_revision:
                    raise CheckFailed('/version: the expected release is not deployed.')
                result['revision'] = revision
            if path == '/api/papers/capabilities':
                extensions = data.get('extensions')
                conversion = data.get('office_conversion')
                if (not isinstance(conversion, bool) or not isinstance(extensions, list) or '.pdf' not in extensions or
                        any(not isinstance(extension, str) or extension not in {'.pdf', '.docx', '.doc', '.odt', '.rtf'} for extension in extensions) or
                        (not conversion and extensions != ['.pdf'])):
                    raise CheckFailed(f'{path}: invalid upload capabilities.')
                result['office_conversion'] = conversion
        results.append(result)
    return results


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--origin', default='https://paperloom.onrender.com')
    parser.add_argument('--expected-revision')
    parser.add_argument('--allow-local', action='store_true', help='Allow HTTP only for localhost smoke tests.')
    args = parser.parse_args()
    try:
        results = check_deployment(args.origin, args.expected_revision, allow_local=args.allow_local)
    except CheckFailed as error:
        print(f'Deployment check failed: {error}', file=sys.stderr)
        return 1
    for result in results:
        print(json.dumps(result))
    return 0


if __name__ == '__main__':
    sys.exit(main())
