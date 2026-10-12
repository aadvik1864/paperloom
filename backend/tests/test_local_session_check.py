from pathlib import Path
import sys
from unittest.mock import Mock
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
from check_local_sessions import NoRedirect, check


@pytest.mark.parametrize('origin', [
    'https://paperloom.onrender.com', 'http://attacker.example',
    'http://localhost@attacker.example', 'http://localhost:5000/api',
    'http://localhost:5000?token=private', 'http://localhost:5000#private',
])
def test_authenticated_smoke_refuses_nonlocal_or_ambiguous_targets(origin, monkeypatch):
    opener = Mock()
    monkeypatch.setattr('check_local_sessions.build_opener', opener)
    with pytest.raises(ValueError) as error:
        check(origin, 'synthetic-password-only')
    assert 'private' not in str(error.value)
    opener.assert_not_called()


def test_authenticated_smoke_never_follows_redirects():
    assert NoRedirect().redirect_request(None, None, 302, 'Found', {}, 'https://attacker.example') is None
