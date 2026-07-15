"""Raw REST client for Canvas New Quizzes and their items."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable
from urllib.parse import urlparse

import requests


class NewQuizApiError(RuntimeError):
    """A sanitized Canvas New Quiz API failure."""

    def __init__(self, message: str, *, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


@dataclass(frozen=True, slots=True)
class NewQuizEndpoints:
    course_id: int | str

    @property
    def quizzes(self) -> str:
        return f"/api/quiz/v1/courses/{self.course_id}/quizzes"

    def quiz(self, assignment_id: int | str) -> str:
        return f"{self.quizzes}/{assignment_id}"

    def items(self, assignment_id: int | str) -> str:
        return f"{self.quiz(assignment_id)}/items"

    def item(self, assignment_id: int | str, item_id: int | str) -> str:
        return f"{self.items(assignment_id)}/{item_id}"


class NewQuizClient:
    """Minimal authenticated client for APIs not represented by canvasapi 3.6."""

    def __init__(
        self,
        base_url: str,
        access_token: str | None = None,
        *,
        session: requests.Session | None = None,
        timeout_seconds: float = 30,
    ) -> None:
        self.base_url = _validated_base_url(base_url)
        self.timeout_seconds = timeout_seconds
        self.session = session or requests.Session()
        if access_token:
            self.session.headers.update({"Authorization": f"Bearer {access_token}"})
        self.session.headers.update(
            {
                "Accept": "application/json+canvas-string-ids",
                "Content-Type": "application/json",
            }
        )

    def list_quizzes(self, course_id: int | str) -> list[dict[str, Any]]:
        return self._get_paginated(NewQuizEndpoints(course_id).quizzes)

    def get_quiz(
        self, course_id: int | str, assignment_id: int | str
    ) -> dict[str, Any]:
        return self._request("GET", NewQuizEndpoints(course_id).quiz(assignment_id))

    def list_items(
        self, course_id: int | str, assignment_id: int | str
    ) -> list[dict[str, Any]]:
        return self._get_paginated(NewQuizEndpoints(course_id).items(assignment_id))

    def get_item(
        self,
        course_id: int | str,
        assignment_id: int | str,
        item_id: int | str,
    ) -> dict[str, Any]:
        return self._request(
            "GET",
            NewQuizEndpoints(course_id).item(assignment_id, item_id),
        )

    def update_quiz(
        self,
        course_id: int | str,
        assignment_id: int | str,
        quiz: dict[str, Any],
    ) -> dict[str, Any]:
        return self._request(
            "PATCH",
            NewQuizEndpoints(course_id).quiz(assignment_id),
            json={"quiz": quiz},
        )

    def update_item(
        self,
        course_id: int | str,
        assignment_id: int | str,
        item_id: int | str,
        item: dict[str, Any],
    ) -> dict[str, Any]:
        return self._request(
            "PATCH",
            NewQuizEndpoints(course_id).item(assignment_id, item_id),
            json={"item": item},
        )

    def _get_paginated(self, path: str) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []
        url: str | None = self._url(path)
        while url:
            response = self._send("GET", url)
            page = self._json(response)
            values = _as_result_list(page)
            results.extend(values)
            next_link = getattr(response, "links", {}).get("next", {})
            url = next_link.get("url")
            if url is not None and not _same_origin(self.base_url, url):
                raise NewQuizApiError("Canvas returned a cross-origin pagination link")
        return results

    def _request(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        response = self._send(method, self._url(path), **kwargs)
        payload = self._json(response)
        if not isinstance(payload, dict):
            raise NewQuizApiError("Canvas returned an unexpected response shape")
        return payload

    def _send(self, method: str, url: str, **kwargs: Any) -> requests.Response:
        try:
            response = self.session.request(
                method,
                url,
                timeout=self.timeout_seconds,
                **kwargs,
            )
            response.raise_for_status()
            return response
        except requests.RequestException as exc:
            status = getattr(getattr(exc, "response", None), "status_code", None)
            if status in (401, 403):
                message = "Canvas rejected the New Quiz credentials or scopes"
            elif status == 404:
                message = "Canvas New Quiz resource was not found"
            elif status == 429:
                message = "Canvas rate-limited the New Quiz request"
            else:
                message = "Canvas New Quiz request failed"
            raise NewQuizApiError(message, status_code=status) from exc

    @staticmethod
    def _json(response: requests.Response) -> Any:
        try:
            return response.json()
        except requests.JSONDecodeError as exc:
            raise NewQuizApiError("Canvas returned a non-JSON response") from exc

    def _url(self, path: str) -> str:
        return f"{self.base_url}/{path.lstrip('/')}"


def _as_result_list(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        values: Iterable[Any] = payload
    elif isinstance(payload, dict):
        if "items" in payload:
            values = payload["items"]
        elif "quizzes" in payload:
            values = payload["quizzes"]
        else:
            raise NewQuizApiError(
                "Canvas paginated response has no items or quizzes collection"
            )
    else:
        raise NewQuizApiError("Canvas returned an unexpected paginated response")
    if not isinstance(values, list) or any(
        not isinstance(value, dict) for value in values
    ):
        raise NewQuizApiError("Canvas returned invalid objects in a paginated response")
    return list(values)


def _validated_base_url(base_url: str) -> str:
    value = base_url.rstrip("/")
    parsed = urlparse(value)
    if parsed.scheme != "https" or not parsed.netloc:
        raise ValueError("Canvas base_url must be an absolute HTTPS URL")
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError(
            "Canvas base_url must not contain credentials, a query, or a fragment"
        )
    return value


def _same_origin(base_url: str, target_url: str) -> bool:
    base = urlparse(base_url)
    target = urlparse(target_url)
    return (base.scheme, base.netloc) == (target.scheme, target.netloc)
