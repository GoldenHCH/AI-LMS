from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from canvas_import.canvas.adapter import (
    CanvasAuthenticationError,
    CanvasCourseSummary,
    CanvasUserSummary,
    CanvasTimeoutError,
    ImportIssue,
    PartialImportError,
)
from canvas_import.fixture_loader import load_fixture_course
from canvas_import.service import app as service

SERVICE_TOKEN = "service-token-with-at-least-thirty-two-bytes"
PAT = "pat-that-must-remain-transient"
ORIGIN = "https://school.instructure.com"
FIXTURES = Path(__file__).parent / "fixtures"


@dataclass
class ServiceDoubles:
    adapter: object
    writer: object


class FakeWriter:
    def __init__(self):
        self.calls = []

    def write(self, course, **kwargs):
        self.calls.append((course, kwargs))
        return "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"


class FakeAdapter:
    def __init__(self, *, courses=None, failure=None, partial=False):
        self.courses = courses if courses is not None else [
            CanvasCourseSummary(101, "Biology")
        ]
        self.failure = failure
        self.partial = partial

    def validate_credentials(self):
        if self.failure:
            raise self.failure
        return CanvasUserSummary("77", "Instructor Example")

    def list_courses(self):
        return self.courses

    def import_course(self, _course_id):
        course = load_fixture_course(FIXTURES / "course_classic.json")
        if self.partial:
            raise PartialImportError(
                course,
                [
                    ImportIssue(
                        "module_item",
                        99,
                        "Canvas resource could not be imported",
                    )
                ],
            )
        return course


@pytest.fixture
def service_client(monkeypatch):
    monkeypatch.setenv("CANVAS_IMPORT_SERVICE_TOKEN", SERVICE_TOKEN)
    adapter = FakeAdapter()
    writer = FakeWriter()
    monkeypatch.setattr(
        service.CanvasAdapter,
        "from_access_token",
        lambda *_args, **_kwargs: adapter,
    )
    monkeypatch.setattr(service, "_course_writer", lambda: writer)
    with TestClient(service.app, raise_server_exceptions=False) as client:
        yield client, ServiceDoubles(adapter, writer)


def headers(token=SERVICE_TOKEN):
    return {
        "x-canvas-import-service-token": token,
        "x-request-id": "33333333-3333-4333-8333-333333333333",
    }


def credentials_payload():
    return {"baseUrl": ORIGIN, "accessToken": PAT}


def test_service_token_is_required_before_processing(service_client):
    client, _doubles = service_client

    response = client.post(
        "/v1/canvas/courses",
        headers=headers("wrong-token-with-at-least-thirty-two-bytes"),
        json=credentials_payload(),
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_credentials"


def test_course_listing_returns_only_the_bounded_response(service_client):
    client, _doubles = service_client

    response = client.post(
        "/v1/canvas/courses", headers=headers(), json=credentials_payload()
    )

    assert response.status_code == 200
    assert response.headers["cache-control"] == "private, no-store"
    assert response.json() == {
        "user": {"canvasUserId": "77", "name": "Instructor Example"},
        "courses": [{"canvasCourseId": "101", "name": "Biology"}],
    }


def test_empty_manageable_course_list_is_a_success(service_client):
    client, doubles = service_client
    doubles.adapter.courses = []

    response = client.post(
        "/v1/canvas/courses", headers=headers(), json=credentials_payload()
    )

    assert response.status_code == 200
    assert response.json()["courses"] == []


def test_forged_course_id_is_rejected(service_client):
    client, doubles = service_client

    response = client.post(
        "/v1/canvas/import",
        headers=headers(),
        json={**credentials_payload(), "canvasCourseId": "999"},
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "unauthorized_course"
    assert doubles.writer.calls == []


def test_complete_import_persists_normalized_origin(service_client):
    client, doubles = service_client

    response = client.post(
        "/v1/canvas/import",
        headers=headers(),
        json={**credentials_payload(), "canvasCourseId": "101"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "courseUuid": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "partial": False,
        "issues": [],
    }
    writer_kwargs = doubles.writer.calls[0][1]
    assert writer_kwargs["canvas_base_url"] == ORIGIN
    assert writer_kwargs["import_issues"] == ()


def test_partial_import_is_persisted_instead_of_dropped(service_client):
    client, doubles = service_client
    doubles.adapter.partial = True

    response = client.post(
        "/v1/canvas/import",
        headers=headers(),
        json={**credentials_payload(), "canvasCourseId": "101"},
    )

    assert response.status_code == 200
    assert response.json()["partial"] is True
    assert response.json()["issues"][0]["phase"] == "module_item"
    assert len(doubles.writer.calls[0][1]["import_issues"]) == 1


def test_invalid_pat_is_sanitized_and_never_returned_or_logged(
    service_client, caplog
):
    client, doubles = service_client
    doubles.adapter.failure = CanvasAuthenticationError(
        "Canvas authorization failed; reconnect and verify API scopes"
    )

    with caplog.at_level("DEBUG"):
        response = client.post(
            "/v1/canvas/courses", headers=headers(), json=credentials_payload()
        )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_credentials"
    assert PAT not in response.text
    assert PAT not in caplog.text


def test_timeout_uses_normalized_error_envelope(service_client):
    client, doubles = service_client
    doubles.adapter.failure = CanvasTimeoutError(
        "Canvas did not finish within the allowed time"
    )

    response = client.post(
        "/v1/canvas/courses", headers=headers(), json=credentials_payload()
    )

    assert response.status_code == 504
    assert response.json()["error"]["code"] == "timeout"


def test_body_limit_uses_uniform_error_envelope(service_client):
    client, _doubles = service_client

    response = client.post(
        "/v1/canvas/courses",
        headers={**headers(), "content-type": "application/json"},
        content=b"{" + b"x" * (service.MAX_BODY_BYTES + 1) + b"}",
    )

    assert response.status_code == 413
    assert response.json()["error"]["code"] == "invalid_input"
