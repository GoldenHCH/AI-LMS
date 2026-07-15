"""Request-local FastAPI sidecar for transient-PAT Canvas course imports.

No instructor accounts: the caller (the Next.js server) presents a shared service
token, and the Canvas personal access token is held only in memory for the request.
"""

from __future__ import annotations

import logging
import os
import secrets
import uuid
from typing import Annotated, Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator
from starlette.exceptions import HTTPException as StarletteHTTPException

from canvas_import.canvas import (
    CanvasAdapter,
    CanvasAuthenticationError,
    CanvasImportError,
    CanvasOriginError,
    CanvasRateLimitError,
    CanvasTimeoutError,
    CanvasUnreachableError,
    PartialImportError,
    validate_canvas_origin,
)
from canvas_import.model import Course
from canvas_import.persistence import SupabaseCourseWriter
from canvas_import.persistence.supabase_writer import SupabasePersistenceError


logging.getLogger("canvasapi").setLevel(logging.INFO)
logger = logging.getLogger("canvas_import.service")

MAX_BODY_BYTES = 8 * 1024
OVERALL_TIMEOUT_SECONDS = 5 * 60
SERVICE_TOKEN_HEADER = "x-canvas-import-service-token"
REQUEST_ID_HEADER = "x-request-id"


class StrictRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class CanvasCredentialsRequest(StrictRequest):
    base_url: Annotated[str, Field(alias="baseUrl", min_length=8, max_length=255)]
    access_token: Annotated[
        SecretStr, Field(alias="accessToken", min_length=8, max_length=4096)
    ]

    @field_validator("base_url")
    @classmethod
    def no_surrounding_whitespace(cls, value: str) -> str:
        if value != value.strip():
            raise ValueError("Canvas URL must not contain surrounding whitespace")
        return value


class CanvasImportRequest(CanvasCredentialsRequest):
    canvas_course_id: Annotated[
        str | int,
        Field(alias="canvasCourseId"),
    ]

    @field_validator("canvas_course_id")
    @classmethod
    def valid_course_id(cls, value: str | int) -> str | int:
        if isinstance(value, bool):
            raise ValueError("Canvas course ID is invalid")
        if not str(value).strip() or len(str(value)) > 128:
            raise ValueError("Canvas course ID is invalid")
        return value


class ServiceError(RuntimeError):
    def __init__(self, code: str, message: str, status_code: int) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


app = FastAPI(
    title="Canvas import service",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)


@app.middleware("http")
async def secure_service_boundary(request: Request, call_next):
    request_id = _request_id(request.headers.get(REQUEST_ID_HEADER))
    request.state.request_id = request_id

    if request.url.path in {"/v1/canvas/courses", "/v1/canvas/import"}:
        expected = os.getenv("CANVAS_IMPORT_SERVICE_TOKEN", "")
        provided = request.headers.get(SERVICE_TOKEN_HEADER, "")
        if len(expected) < 32:
            return _error_response(
                "internal_failure",
                "Canvas import service is not configured",
                request_id,
                503,
            )
        if not secrets.compare_digest(provided, expected):
            return _error_response(
                "invalid_credentials",
                "Canvas import service authorization failed",
                request_id,
                401,
            )

        content_length = request.headers.get("content-length")
        if content_length:
            try:
                declared_length = int(content_length)
            except ValueError:
                declared_length = MAX_BODY_BYTES + 1
            if declared_length > MAX_BODY_BYTES:
                return _error_response(
                    "invalid_input", "Request body is too large", request_id, 413
                )
        body = await request.body()
        if len(body) > MAX_BODY_BYTES:
            return _error_response(
                "invalid_input", "Request body is too large", request_id, 413
            )

    response = await call_next(request)
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["Pragma"] = "no-cache"
    response.headers["X-Request-ID"] = request_id
    return response


@app.exception_handler(ServiceError)
async def handle_service_error(request: Request, exc: ServiceError):
    return _error_response(
        exc.code,
        exc.message,
        _state_request_id(request),
        exc.status_code,
    )


@app.exception_handler(RequestValidationError)
async def handle_validation_error(request: Request, _exc: RequestValidationError):
    return _error_response(
        "invalid_input",
        "Request fields are invalid",
        _state_request_id(request),
        422,
    )


@app.exception_handler(StarletteHTTPException)
async def handle_http_error(request: Request, exc: StarletteHTTPException):
    return _error_response(
        "invalid_input",
        "The requested Canvas import operation is not available",
        _state_request_id(request),
        exc.status_code,
    )


@app.exception_handler(Exception)
async def handle_unexpected_error(request: Request, exc: Exception):
    request_id = _state_request_id(request)
    logger.error("Canvas import request %s failed with %s", request_id, type(exc).__name__)
    return _error_response(
        "internal_failure",
        "Canvas import failed safely",
        request_id,
        500,
    )


@app.post("/v1/canvas/courses")
def list_canvas_courses(
    payload: CanvasCredentialsRequest,
    request: Request,
) -> dict[str, Any]:
    _state_request_id(request)
    normalized_origin = _origin(payload.base_url)
    adapter = CanvasAdapter.from_access_token(
        normalized_origin,
        payload.access_token.get_secret_value(),
        new_quizzes_editable=False,
        overall_timeout_seconds=OVERALL_TIMEOUT_SECONDS,
    )
    try:
        user = adapter.validate_credentials()
        courses = adapter.list_courses()
    except Exception as exc:
        raise _classify_error(exc) from None
    return {
        "user": {
            "canvasUserId": user.canvas_user_id,
            "name": user.name,
        },
        "courses": [
            {
                "canvasCourseId": str(course.canvas_course_id),
                "name": course.name,
            }
            for course in courses
        ],
    }


@app.post("/v1/canvas/import")
def import_canvas_course(
    payload: CanvasImportRequest,
    request: Request,
) -> dict[str, Any]:
    _state_request_id(request)
    normalized_origin = _origin(payload.base_url)
    selected_id = str(payload.canvas_course_id)
    try:
        adapter = CanvasAdapter.from_access_token(
            normalized_origin,
            payload.access_token.get_secret_value(),
            new_quizzes_editable=False,
            overall_timeout_seconds=OVERALL_TIMEOUT_SECONDS,
        )
        adapter.validate_credentials()
        allowed_ids = {
            str(course.canvas_course_id) for course in adapter.list_courses()
        }
        if selected_id not in allowed_ids:
            raise ServiceError(
                "unauthorized_course",
                "This Canvas course is not instructor-manageable",
                403,
            )

        issues: tuple[Any, ...] = ()
        try:
            course = adapter.import_course(payload.canvas_course_id)
        except PartialImportError as partial:
            course = partial.course
            issues = partial.issues

        course_uuid = _course_writer().write(
            course,
            canvas_base_url=normalized_origin,
            import_issues=issues,
        )
        return {
            "courseUuid": course_uuid,
            "partial": bool(issues),
            "issues": [_issue_payload(issue) for issue in issues],
        }
    except Exception as exc:
        raise _classify_error(exc) from None


def _origin(value: str) -> str:
    try:
        return validate_canvas_origin(value)
    except CanvasOriginError as exc:
        raise _classify_error(exc) from None


def _course_writer() -> SupabaseCourseWriter:
    try:
        return SupabaseCourseWriter()
    except Exception as exc:
        raise _classify_error(exc) from None


def _classify_error(exc: Exception) -> ServiceError:
    if isinstance(exc, ServiceError):
        return exc
    if isinstance(exc, CanvasOriginError):
        return ServiceError("unsupported_host", str(exc), 400)
    if isinstance(exc, CanvasAuthenticationError):
        return ServiceError("invalid_credentials", str(exc), 401)
    if isinstance(exc, CanvasRateLimitError):
        return ServiceError("rate_limited", str(exc), 429)
    if isinstance(exc, CanvasTimeoutError):
        return ServiceError("timeout", str(exc), 504)
    if isinstance(exc, CanvasUnreachableError):
        return ServiceError("unreachable_canvas", str(exc), 502)
    if isinstance(exc, (SupabasePersistenceError, ValueError)):
        return ServiceError("persistence_failure", "Course storage is unavailable", 503)
    if isinstance(exc, CanvasImportError):
        return ServiceError("internal_failure", str(exc), 502)
    return ServiceError("internal_failure", "Canvas import failed safely", 500)


def _course_counts(course: Course, issue_count: int) -> dict[str, int]:
    items = [item for module in course.modules for item in module.items]
    return {
        "moduleCount": len(course.modules),
        "itemCount": len(items),
        "pageCount": sum(item.page is not None for item in items),
        "quizCount": sum(item.quiz is not None for item in items),
        "opaqueCount": sum(item.kind == "opaque" for item in items),
        "issueCount": issue_count,
    }


def _issue_payload(issue: Any) -> dict[str, str | None]:
    canvas_id = getattr(issue, "canvas_id", None)
    return {
        "phase": str(getattr(issue, "phase", "resource"))[:64],
        "canvasId": str(canvas_id)[:128] if canvas_id is not None else None,
        "message": str(
            getattr(issue, "message", "Canvas resource could not be imported")
        )[:160],
    }


def _request_id(value: str | None) -> str:
    try:
        return str(uuid.UUID(value or ""))
    except ValueError:
        return str(uuid.uuid4())


def _state_request_id(request: Request) -> str:
    return getattr(request.state, "request_id", str(uuid.uuid4()))


def _error_response(
    code: str,
    message: str,
    request_id: str,
    status_code: int,
) -> JSONResponse:
    return JSONResponse(
        {"error": {"code": code, "message": message, "requestId": request_id}},
        status_code=status_code,
        headers={
            "Cache-Control": "private, no-store",
            "Pragma": "no-cache",
            "X-Request-ID": request_id,
        },
    )
