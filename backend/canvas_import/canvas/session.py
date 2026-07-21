"""Request-local, redirect-free HTTP sessions for Canvas import reads."""

from __future__ import annotations

import time
from collections.abc import Collection
from typing import Any
from urllib.parse import urlsplit

import requests


class CanvasOverallTimeout(requests.Timeout):
    """The synchronous Canvas phase exhausted its total time budget."""


class HardenedCanvasSession(requests.Session):
    def __init__(
        self,
        *,
        timeout_seconds: float = 30,
        deadline_at: float | None = None,
        allowed_methods: Collection[str] = ("GET",),
        allowed_origin: str | None = None,
    ) -> None:
        super().__init__()
        self.timeout_seconds = timeout_seconds
        self.deadline_at = deadline_at
        self.allowed_methods = {method.upper() for method in allowed_methods}
        self.allowed_origin = allowed_origin

    def request(self, method: str, url: str, **kwargs: Any) -> requests.Response:
        normalized_method = method.upper()
        if normalized_method not in self.allowed_methods:
            raise requests.RequestException("Canvas import requests are GET-only")
        if self.allowed_origin is not None and not _same_origin(
            self.allowed_origin, url
        ):
            raise requests.RequestException("Cross-origin Canvas requests are disabled")

        timeout = self.timeout_seconds
        if self.deadline_at is not None:
            remaining = self.deadline_at - time.monotonic()
            if remaining <= 0:
                raise CanvasOverallTimeout("Canvas import timed out")
            timeout = min(timeout, remaining)

        kwargs["timeout"] = min(float(kwargs.get("timeout", timeout)), timeout)
        kwargs["allow_redirects"] = False
        response = super().request(normalized_method, url, **kwargs)
        if 300 <= response.status_code < 400:
            raise requests.TooManyRedirects(
                "Canvas redirects are disabled", response=response
            )
        return response


def _same_origin(expected: str, target: str) -> bool:
    expected_url = urlsplit(expected)
    target_url = urlsplit(target)
    expected_port = expected_url.port or 443
    target_port = target_url.port or 443
    return (
        target_url.scheme.lower() == "https"
        and target_url.hostname == expected_url.hostname
        and target_port == expected_port
    )
