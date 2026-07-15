from __future__ import annotations

from urllib.parse import parse_qs, urlparse

import pytest

from canvas_import.canvas.oauth import CanvasOAuthClient, OAuthError


class FakeResponse:
    def __init__(self, payload, status_code=200):
        self.payload = payload
        self.status_code = status_code

    def raise_for_status(self):
        return None

    def json(self):
        return self.payload


class FakeSession:
    def __init__(self):
        self.calls = []

    def post(self, url, **kwargs):
        self.calls.append((url, kwargs))
        return FakeResponse(
            {
                "access_token": "secret-access-token",
                "refresh_token": "secret-refresh-token",
                "expires_in": 3600,
                "token_type": "Bearer",
                "scope": "scope:a scope:b",
            }
        )


def client(session=None):
    return CanvasOAuthClient(
        "https://canvas.example.edu",
        "client-id",
        "client-secret",
        "https://app.example.edu/oauth/callback",
        session=session,
    )


def test_authorization_url_has_state_redirect_and_least_privilege_scopes():
    state = client().new_state()
    url = client().authorization_url(state)
    query = parse_qs(urlparse(url).query)

    assert query["state"] == [state]
    assert query["response_type"] == ["code"]
    assert query["redirect_uri"] == ["https://app.example.edu/oauth/callback"]
    assert "url:GET|/api/v1/courses" in query["scope"][0]
    assert "POST" not in query["scope"][0]


def test_state_mismatch_is_rejected():
    with pytest.raises(OAuthError, match="state"):
        client().verify_state("expected", "received")


def test_token_exchange_does_not_leak_secrets_in_repr():
    session = FakeSession()
    token = client(session).exchange_code("one-time-code")

    assert token.access_token == "secret-access-token"
    assert token.refresh_token == "secret-refresh-token"
    assert "secret-access-token" not in repr(token)
    assert "secret-refresh-token" not in repr(token)
    assert session.calls[0][1]["data"]["client_secret"] == "client-secret"


@pytest.mark.parametrize(
    "base_url",
    [
        "http://canvas.example.edu",
        "canvas.example.edu",
        "https://user:pass@canvas.example.edu",
    ],
)
def test_non_https_or_credentialed_canvas_urls_are_rejected(base_url):
    with pytest.raises(ValueError):
        CanvasOAuthClient(base_url, "id", "secret", "https://app.example.edu/callback")
