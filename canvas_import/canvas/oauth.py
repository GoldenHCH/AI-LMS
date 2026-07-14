"""Canvas OAuth2 primitives without application-specific token persistence."""

from __future__ import annotations

import hmac
import secrets
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any, Iterable
from urllib.parse import urlencode

import requests

from .new_quizzes import _validated_base_url

# Least-privilege import scopes. Write scopes belong to the later confirmed-export flow.
IMPORT_SCOPES = (
    "url:GET|/api/v1/courses",
    "url:GET|/api/v1/courses/:course_id",
    "url:GET|/api/v1/courses/:course_id/modules",
    "url:GET|/api/v1/courses/:course_id/modules/:module_id/items",
    "url:GET|/api/v1/courses/:course_id/pages/:url_or_id",
    "url:GET|/api/v1/courses/:course_id/files",
    "url:GET|/api/v1/courses/:course_id/quizzes/:id",
    "url:GET|/api/v1/courses/:course_id/quizzes/:quiz_id/questions",
    "url:GET|/api/quiz/v1/courses/:course_id/quizzes/:assignment_id",
    "url:GET|/api/quiz/v1/courses/:course_id/quizzes/:assignment_id/items",
)


class OAuthError(RuntimeError):
    """Sanitized Canvas OAuth error."""


@dataclass(frozen=True, slots=True)
class OAuthToken:
    access_token: str = field(repr=False)
    refresh_token: str | None = field(default=None, repr=False)
    expires_at: datetime | None = None
    token_type: str = "Bearer"
    scopes: tuple[str, ...] = ()


class CanvasOAuthClient:
    """Build authorization URLs and exchange/refresh short-lived Canvas tokens.

    OAuth state and tokens must be stored by the host application in encrypted,
    server-side session/credential storage. They are intentionally never written to
    the course working-copy document.
    """

    def __init__(
        self,
        base_url: str,
        client_id: str,
        client_secret: str,
        redirect_uri: str,
        *,
        session: requests.Session | None = None,
        timeout_seconds: float = 30,
    ) -> None:
        if not client_id or not client_secret:
            raise ValueError("Canvas OAuth client credentials are required")
        self.base_url = _validated_base_url(base_url)
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri
        self.session = session or requests.Session()
        self.timeout_seconds = timeout_seconds

    @staticmethod
    def new_state() -> str:
        return secrets.token_urlsafe(32)

    @staticmethod
    def verify_state(expected: str, received: str) -> None:
        if not expected or not received or not hmac.compare_digest(expected, received):
            raise OAuthError("Canvas OAuth state validation failed")

    def authorization_url(
        self,
        state: str,
        *,
        scopes: Iterable[str] = IMPORT_SCOPES,
        purpose: str = "Import and edit a Canvas course",
    ) -> str:
        if not state:
            raise ValueError("A server-stored OAuth state value is required")
        params = {
            "client_id": self.client_id,
            "response_type": "code",
            "redirect_uri": self.redirect_uri,
            "state": state,
            "scope": " ".join(scopes),
            "purpose": purpose,
        }
        return f"{self.base_url}/login/oauth2/auth?{urlencode(params)}"

    def exchange_code(self, code: str) -> OAuthToken:
        if not code:
            raise ValueError("Canvas OAuth authorization code is required")
        return self._token_request(
            {
                "grant_type": "authorization_code",
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "redirect_uri": self.redirect_uri,
                "code": code,
            }
        )

    def refresh(self, refresh_token: str) -> OAuthToken:
        if not refresh_token:
            raise ValueError("Canvas OAuth refresh token is required")
        return self._token_request(
            {
                "grant_type": "refresh_token",
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "refresh_token": refresh_token,
            }
        )

    def _token_request(self, data: dict[str, str]) -> OAuthToken:
        try:
            response = self.session.post(
                f"{self.base_url}/login/oauth2/token",
                data=data,
                timeout=self.timeout_seconds,
                headers={"Accept": "application/json"},
            )
            response.raise_for_status()
            payload: Any = response.json()
        except (requests.RequestException, requests.JSONDecodeError) as exc:
            raise OAuthError("Canvas OAuth token exchange failed") from exc
        if not isinstance(payload, dict) or not isinstance(payload.get("access_token"), str):
            raise OAuthError("Canvas OAuth response did not include an access token")
        expires_in = payload.get("expires_in")
        expires_at = None
        if isinstance(expires_in, (int, float)):
            expires_at = datetime.now(UTC) + timedelta(seconds=expires_in)
        raw_scope = payload.get("scope", "")
        scopes = tuple(raw_scope.split()) if isinstance(raw_scope, str) else ()
        return OAuthToken(
            access_token=payload["access_token"],
            refresh_token=payload.get("refresh_token"),
            expires_at=expires_at,
            token_type=payload.get("token_type", "Bearer"),
            scopes=scopes,
        )
