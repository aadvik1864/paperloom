import json
import sys
from email.message import Message
from io import BytesIO
from pathlib import Path
from unittest.mock import Mock
from urllib.error import URLError
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
from check_deployment import CheckFailed, NoRedirect, check_deployment, read_response, validate_origin


class Response(BytesIO):
    def __init__(self, body, status=200):
        super().__init__(body)
        self.status = status
        self.headers = Message()
        self.headers['Content-Type'] = 'application/json'
        self.headers['Content-Security-Policy'] = "default-src 'self'; object-src 'none'"
        self.headers['X-Content-Type-Options'] = 'nosniff'
        self.headers['Strict-Transport-Security'] = 'max-age=31536000'
        self.headers['Cache-Control'] = 'no-store'


def responses(revision='a' * 40):
    root = Response(b'<html>Paperloom</html>')
    root.headers.replace_header('Content-Type', 'text/html')
    return [root,
            Response(b'{"status":"healthy","service":"paperloom"}'),
            Response(b'{"status":"alive","service":"paperloom"}'),
            Response(json.dumps({'service': 'paperloom', 'revision': revision}).encode()),
            Response(b'{"extensions":[".pdf"],"office_conversion":false}'),
            Response(b'{}', 404), Response(b'{}', 404), Response(b'{}', 401), Response(b'{}', 401), Response(b'{}', 401)]


def test_deployment_checks_are_read_only():
    opener = Mock()
    opener.open.side_effect = responses()
    results = check_deployment('https://example.com', 'a' * 40, opener=opener)
    assert len(results) == 10
    assert results[3]['revision'] == 'a' * 40
    assert all(call.args[0].get_method() == 'GET' for call in opener.open.call_args_list)
    assert all(not call.args[0].has_header('Authorization') for call in opener.open.call_args_list)


@pytest.mark.parametrize('origin', ['http://example.com', 'https://user:private@example.com', 'https://example.com/api', 'https://example.com?token=private', 'https://example.com#private'])
def test_invalid_check_origins_are_rejected_without_echoing_input(origin):
    with pytest.raises(CheckFailed) as error:
        validate_origin(origin)
    assert 'private' not in str(error.value)


def test_local_check_is_explicit():
    assert validate_origin('http://127.0.0.1:5000/', allow_local=True) == 'http://127.0.0.1:5000'
    with pytest.raises(CheckFailed):
        validate_origin('http://example.com', allow_local=True)


def test_revision_mismatch_fails():
    opener = Mock()
    opener.open.side_effect = responses('b' * 40)
    with pytest.raises(CheckFailed, match='expected release'):
        check_deployment('https://example.com', 'a' * 40, opener=opener)


def test_missing_security_headers_fail():
    response = Response(b'{}')
    del response.headers['Content-Security-Policy']
    opener = Mock()
    opener.open.return_value = response
    with pytest.raises(CheckFailed, match='Security Policy'):
        check_deployment('https://example.com', opener=opener)


def test_upstream_errors_are_not_echoed():
    opener = Mock()
    opener.open.side_effect = URLError('private upstream details')
    with pytest.raises(CheckFailed) as error:
        read_response(opener, 'https://example.com')
    assert 'private' not in str(error.value)


def test_checks_never_follow_redirects():
    assert NoRedirect().redirect_request(None, None, 302, 'Found', {}, 'https://other.example') is None
