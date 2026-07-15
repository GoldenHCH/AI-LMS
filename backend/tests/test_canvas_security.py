from __future__ import annotations

import requests
import pytest

from canvas_import.canvas.adapter import CanvasAdapter, CanvasAuthenticationError
from canvas_import.canvas.origin import CanvasOriginError, validate_canvas_origin
from canvas_import.canvas.session import HardenedCanvasSession


class FakeHttpError(RuntimeError):
    def __init__(self, status_code: int, secret: str) -> None:
        super().__init__(f"HTTP {status_code}: {secret}")
        self.status_code = status_code


class FakeCanvas:
    def __init__(self) -> None:
        self.calls: list[tuple[str, object]] = []

    def get_current_user(self):
        self.calls.append(("GET", "users/self"))
        return {"id": 77, "name": "Instructor Example"}

    def get_courses(self, **kwargs):
        self.calls.append(("GET", kwargs))
        return [
            {"id": 10, "name": "Course A"},
            {"id": "10", "name": "Duplicate"},
            {"id": 20, "course_code": "Course B"},
        ]


def test_credentials_and_course_listing_are_get_only_role_filtered_and_deduplicated():
    canvas = FakeCanvas()
    adapter = CanvasAdapter(canvas)

    user = adapter.validate_credentials()
    courses = adapter.list_courses()

    assert user.canvas_user_id == "77"
    assert user.name == "Instructor Example"
    assert [str(course.canvas_course_id) for course in courses] == ["10", "20"]
    assert canvas.calls == [
        ("GET", "users/self"),
        ("GET", {"enrollment_type": "teacher", "enrollment_state": "active"}),
        ("GET", {"enrollment_type": "ta", "enrollment_state": "active"}),
        ("GET", {"enrollment_type": "designer", "enrollment_state": "active"}),
    ]


def test_authentication_error_never_exposes_canvas_response_details():
    class RejectedCanvas:
        def get_current_user(self):
            raise FakeHttpError(401, "PAT-should-never-appear")

    with pytest.raises(CanvasAuthenticationError) as caught:
        CanvasAdapter(RejectedCanvas()).validate_credentials()

    assert "PAT-should-never-appear" not in str(caught.value)


@pytest.mark.parametrize(
    "value",
    [
        "http://school.instructure.com",
        "https://school.instructure.com/path",
        "https://user:pass@school.instructure.com",
        "https://school.instructure.com:8443",
        "https://127.0.0.1",
        "https://localhost",
        "https://unapproved.example.edu",
    ],
)
def test_unsupported_or_private_canvas_origins_are_rejected(value: str):
    with pytest.raises(CanvasOriginError):
        validate_canvas_origin(value, configured_hosts="")


def test_configured_self_hosted_canvas_origin_is_normalized():
    assert (
        validate_canvas_origin(
            "https://Canvas.Example.edu:443/",
            configured_hosts="canvas.example.edu",
        )
        == "https://canvas.example.edu"
    )


def test_redirects_are_rejected_without_following_the_location(monkeypatch):
    calls = []

    def fake_request(_self, method, url, **kwargs):
        calls.append((method, url, kwargs))
        response = requests.Response()
        response.status_code = 302
        response.url = url
        response.headers["Location"] = "https://attacker.example/collect"
        return response

    monkeypatch.setattr(requests.Session, "request", fake_request)
    session = HardenedCanvasSession(
        allowed_origin="https://school.instructure.com"
    )

    with pytest.raises(requests.TooManyRedirects):
        session.get("https://school.instructure.com/api/v1/users/self")

    assert len(calls) == 1
    assert calls[0][2]["allow_redirects"] is False


def test_cross_origin_requests_are_rejected_before_network(monkeypatch):
    called = False

    def fake_request(*_args, **_kwargs):
        nonlocal called
        called = True
        raise AssertionError("network should not be reached")

    monkeypatch.setattr(requests.Session, "request", fake_request)
    session = HardenedCanvasSession(
        allowed_origin="https://school.instructure.com"
    )

    with pytest.raises(requests.RequestException, match="Cross-origin"):
        session.get("https://attacker.example/api/v1/courses")

    assert called is False
