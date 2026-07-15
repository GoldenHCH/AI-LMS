"""Bidirectional mapping between Canvas API objects and the internal course model.

The import path performs GET operations only. The export direction implemented here is
an in-memory dry-run snapshot; writing to Canvas remains a separately confirmed flow.
"""

from __future__ import annotations

import logging
import time
from copy import deepcopy
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Iterable

import requests

from canvas_import.model import (
    Answer,
    Course,
    FileRef,
    Module,
    ModuleItem,
    Page,
    Question,
    Quiz,
)

from .new_quizzes import NewQuizClient
from .origin import validate_canvas_origin
from .session import CanvasOverallTimeout, HardenedCanvasSession


class CanvasImportError(RuntimeError):
    """A clear, sanitized Canvas import failure."""


class CanvasAuthenticationError(CanvasImportError):
    """Canvas rejected or could not authorize the import."""


class CanvasRateLimitError(CanvasImportError):
    """Canvas asked the caller to retry later."""


class CanvasTimeoutError(CanvasImportError):
    """A Canvas request or the overall import exceeded its time budget."""


class CanvasUnreachableError(CanvasImportError):
    """Canvas could not be reached without exposing network details."""


@dataclass(frozen=True, slots=True)
class ImportIssue:
    phase: str
    canvas_id: int | str | None
    message: str


class PartialImportError(CanvasImportError):
    """An import completed only partially; callers must not treat it as lossless."""

    def __init__(self, course: Course, issues: list[ImportIssue]) -> None:
        super().__init__(f"Canvas course import was partial ({len(issues)} issue(s))")
        self.course = course
        self.issues = tuple(issues)


@dataclass(frozen=True, slots=True)
class CanvasCourseSummary:
    canvas_course_id: int | str
    name: str


@dataclass(frozen=True, slots=True)
class CanvasUserSummary:
    canvas_user_id: str
    name: str


class CanvasAdapter:
    """Map Canvas resources to/from a faithful LMS-agnostic course document."""

    def __init__(
        self,
        canvas: Any,
        *,
        new_quiz_client: NewQuizClient | None = None,
        new_quizzes_editable: bool = False,
    ) -> None:
        self.canvas = canvas
        self.new_quiz_client = new_quiz_client
        self.new_quizzes_editable = new_quizzes_editable

    @classmethod
    def from_access_token(
        cls,
        base_url: str,
        access_token: str,
        *,
        new_quizzes_editable: bool = False,
        overall_timeout_seconds: float = 300,
    ) -> CanvasAdapter:
        """Construct request-local, read-only clients from a transient Canvas PAT."""

        from canvasapi import Canvas

        normalized_origin = validate_canvas_origin(base_url)
        deadline_at = time.monotonic() + overall_timeout_seconds
        canvas = Canvas(normalized_origin, access_token)
        requester = canvas._Canvas__requester  # noqa: SLF001 - canvasapi has no hook
        requester._session = HardenedCanvasSession(  # noqa: SLF001
            timeout_seconds=30,
            deadline_at=deadline_at,
            allowed_origin=normalized_origin,
        )

        # canvasapi logs response bodies at DEBUG. Imports never permit that
        # verbosity, even if the host process enables debug logging globally.
        logging.getLogger("canvasapi").setLevel(logging.INFO)

        return cls(
            canvas,
            new_quiz_client=NewQuizClient(
                normalized_origin,
                access_token,
                session=HardenedCanvasSession(
                    timeout_seconds=30,
                    deadline_at=deadline_at,
                    allowed_origin=normalized_origin,
                ),
                read_only=True,
            ),
            new_quizzes_editable=new_quizzes_editable,
        )

    def validate_credentials(self) -> CanvasUserSummary:
        """Validate the PAT through GET /api/v1/users/self only."""

        try:
            user = self.canvas.get_current_user()
            raw = _snapshot(user)
            canvas_user_id = _required(raw, "id")
        except Exception as exc:
            raise _classified_import_error(
                exc, "Could not validate Canvas credentials"
            ) from exc
        return CanvasUserSummary(
            canvas_user_id=str(canvas_user_id),
            name=str(raw.get("name") or raw.get("short_name") or "Canvas user"),
        )

    def list_courses(self) -> list[CanvasCourseSummary]:
        """List the instructor's manageable courses without hiding auth or API failures.

        Canvas ``GET /courses`` accepts ``enrollment_type`` as a single value, so each
        teaching role is queried separately and the results merged (deduplicated by
        course id). Passing a list serializes to ``enrollment_type[]`` which Canvas
        rejects with a 500.
        """

        deduplicated: dict[str, CanvasCourseSummary] = {}
        for role in ("teacher", "ta", "designer"):
            try:
                courses = list(
                    self.canvas.get_courses(
                        enrollment_type=role,
                        enrollment_state="active",
                    )
                )
            except Exception as exc:
                raise _classified_import_error(
                    exc, "Could not list Canvas courses"
                ) from exc
            for course in courses:
                raw = _snapshot(course)
                canvas_course_id = _required(raw, "id")
                key = str(canvas_course_id)
                if key not in deduplicated:
                    deduplicated[key] = CanvasCourseSummary(
                        canvas_course_id=canvas_course_id,
                        name=str(
                            raw.get("name")
                            or raw.get("course_code")
                            or "Untitled course"
                        ),
                    )
        return list(deduplicated.values())

    def import_course(self, course_id: int | str) -> Course:
        """Import one course with no Canvas writes and no silently swallowed failures."""

        try:
            canvas_course = self.canvas.get_course(course_id)
            course_raw = _snapshot(canvas_course)
        except Exception as exc:
            raise _classified_import_error(exc, "Could not read Canvas course") from exc

        issues: list[ImportIssue] = []
        files = self._import_files(canvas_course, issues)
        files_by_id = {str(file.file_id): file for file in files}
        modules: list[Module] = []

        try:
            canvas_modules = list(canvas_course.get_modules(include=["items"]))
        except Exception as exc:
            raise _classified_import_error(
                exc, "Could not read Canvas course modules"
            ) from exc

        for canvas_module in canvas_modules:
            module_raw = _snapshot(canvas_module)
            module_id = _required(module_raw, "id")
            try:
                raw_items = module_raw.get("items")
                if raw_items is None:
                    raw_items = list(canvas_module.get_module_items())
                else:
                    raw_items = list(raw_items)
            except Exception as exc:
                issues.append(
                    ImportIssue("module_items", module_id, _safe_failure_message(exc))
                )
                raw_items = []

            items: list[ModuleItem] = []
            for raw_item in raw_items:
                item_snapshot = _snapshot(raw_item)
                try:
                    items.append(
                        self._import_item(
                            canvas_course,
                            course_id,
                            item_snapshot,
                            files_by_id,
                        )
                    )
                except Exception as exc:
                    item_id = item_snapshot.get("id")
                    issues.append(
                        ImportIssue("module_item", item_id, _safe_failure_message(exc))
                    )
                    # Keep the item's place and raw payload, but mark the whole import partial.
                    items.append(
                        ModuleItem(
                            canvas_module_item_id=item_id
                            or f"unidentified-{len(items)}",
                            position=_integer(
                                item_snapshot.get("position"), len(items) + 1
                            ),
                            kind="opaque",
                            opaque=deepcopy(item_snapshot),
                            raw_payload=deepcopy(item_snapshot),
                        )
                    )

            clean_module_raw = deepcopy(module_raw)
            clean_module_raw.pop("items", None)
            modules.append(
                Module(
                    canvas_module_id=module_id,
                    name=str(module_raw.get("name", "")),
                    position=_integer(module_raw.get("position"), len(modules) + 1),
                    items=items,
                    raw_payload=clean_module_raw,
                )
            )

        course = Course(
            canvas_course_id=course_raw.get("id", course_id),
            name=str(
                course_raw.get("name")
                or course_raw.get("course_code")
                or "Untitled course"
            ),
            modules=modules,
            files=files,
            raw_payload=course_raw,
        )
        if issues:
            raise PartialImportError(course, issues)
        return course

    def export_dry_run(self, course: Course) -> dict[str, Any]:
        """Render the Canvas-facing snapshot without issuing any API request."""

        course_payload = deepcopy(course.raw_payload)
        _set(course_payload, "id", course.canvas_course_id)
        _set(course_payload, "name", course.name)

        modules: list[dict[str, Any]] = []
        for module in course.modules:
            module_payload = deepcopy(module.raw_payload)
            _set(module_payload, "id", module.canvas_module_id)
            _set(module_payload, "name", module.name)
            _set(module_payload, "position", module.position)
            module_payload.pop("items", None)
            modules.append(
                {
                    "module": module_payload,
                    "items": [self._export_item(item) for item in module.items],
                }
            )
        return {
            "course": course_payload,
            "modules": modules,
            "files": [_export_file(file) for file in course.files],
        }

    def _import_files(
        self, canvas_course: Any, issues: list[ImportIssue]
    ) -> list[FileRef]:
        try:
            return [
                _file_from_canvas(_snapshot(file)) for file in canvas_course.get_files()
            ]
        except Exception as exc:
            issues.append(ImportIssue("files", None, _safe_failure_message(exc)))
            return []

    def _import_item(
        self,
        canvas_course: Any,
        course_id: int | str,
        raw: dict[str, Any],
        files_by_id: dict[str, FileRef],
    ) -> ModuleItem:
        item_id = _required(raw, "id")
        position = _integer(raw.get("position"), 0)
        item_type = str(raw.get("type", "")).lower()
        common = {
            "canvas_module_item_id": item_id,
            "position": position,
            "raw_payload": deepcopy(raw),
        }

        if item_type == "page":
            page_url = raw.get("page_url") or raw.get("url")
            if not page_url:
                raise CanvasImportError(
                    "Canvas page module item has no stable page URL"
                )
            page = _page_from_canvas(_snapshot(canvas_course.get_page(page_url)))
            return ModuleItem(kind="page", page=page, **common)

        if item_type == "quiz":
            content_id = raw.get("content_id")
            if content_id is None:
                raise CanvasImportError("Canvas quiz module item has no content ID")
            quiz = self._import_quiz(canvas_course, course_id, content_id)
            return ModuleItem(kind="quiz", quiz=quiz, **common)

        if item_type == "file":
            content_id = raw.get("content_id")
            file = files_by_id.get(str(content_id))
            if file is None:
                file = _file_from_module_item(raw)
            return ModuleItem(kind="file", file=file, **common)

        return ModuleItem(kind="opaque", opaque=deepcopy(raw), **common)

    def _import_quiz(
        self,
        canvas_course: Any,
        course_id: int | str,
        content_id: int | str,
    ) -> Quiz:
        try:
            canvas_quiz = canvas_course.get_quiz(content_id)
        except Exception as exc:
            if not _is_not_found(exc):
                raise
        else:
            quiz_raw = _snapshot(canvas_quiz)
            question_raws = [
                _snapshot(question) for question in canvas_quiz.get_questions()
            ]
            return _classic_quiz_from_canvas(quiz_raw, question_raws)
        if self.new_quiz_client is None:
            raise CanvasImportError(
                "Quiz is not available through the Classic API and no New Quiz client is configured"
            )
        quiz_raw = self.new_quiz_client.get_quiz(course_id, content_id)
        item_raws = self.new_quiz_client.list_items(course_id, content_id)
        return _new_quiz_from_canvas(
            quiz_raw,
            item_raws,
            assignment_id=content_id,
            write_enabled=self.new_quizzes_editable,
        )

    def _export_item(self, item: ModuleItem) -> dict[str, Any]:
        module_item_payload = deepcopy(item.raw_payload)
        _set(module_item_payload, "id", item.canvas_module_item_id)
        _set(module_item_payload, "position", item.position)
        if item.page is not None:
            content = {"kind": "page", "page": _export_page(item.page)}
        elif item.quiz is not None:
            content = {
                "kind": "quiz",
                "engine": item.quiz.engine,
                "quiz": _export_quiz(item.quiz),
                "questions": [
                    _export_question(question, item.quiz.engine)
                    for question in item.quiz.questions
                ],
            }
        elif item.file is not None:
            content = {"kind": "file", "file": _export_file(item.file)}
        else:
            content = {"kind": "opaque", "payload": deepcopy(item.opaque)}
        return {"module_item": module_item_payload, "content": content}


def _page_from_canvas(raw: dict[str, Any]) -> Page:
    page_url = raw.get("url") or raw.get("page_url")
    if page_url is None:
        raise CanvasImportError("Canvas page response has no stable URL")
    body = raw.get("body")
    return Page(
        page_url=str(page_url),
        page_id=raw.get("page_id", raw.get("id")),
        title=str(raw.get("title", "")),
        body_html=body if isinstance(body, str) else "",
        published=raw.get("published"),
        front_page=raw.get("front_page"),
        raw_payload=deepcopy(raw),
    )


def _classic_quiz_from_canvas(
    quiz_raw: dict[str, Any], question_raws: Iterable[dict[str, Any]]
) -> Quiz:
    questions = [_classic_question_from_canvas(raw) for raw in question_raws]
    clean_quiz_raw = deepcopy(quiz_raw)
    clean_quiz_raw.pop("questions", None)
    return Quiz(
        quiz_id=_required(quiz_raw, "id"),
        engine="classic",
        title=str(quiz_raw.get("title", "")),
        description_html=_string(quiz_raw.get("description")),
        points_possible=quiz_raw.get("points_possible"),
        question_count=len(questions),
        questions=questions,
        raw_payload=clean_quiz_raw,
    )


def _classic_question_from_canvas(raw: dict[str, Any]) -> Question:
    answers = [
        _classic_answer_from_canvas(_snapshot(answer))
        for answer in raw.get("answers") or []
    ]
    normalized = {
        "id",
        "position",
        "question_type",
        "question_text",
        "points_possible",
        "answers",
    }
    return Question(
        question_id=_required(raw, "id"),
        position=_integer(raw.get("position"), 0),
        question_type=str(raw.get("question_type", "unknown")),
        stem_html=_string(raw.get("question_text")),
        points_possible=raw.get("points_possible"),
        answers=answers,
        type_specific={
            key: deepcopy(value) for key, value in raw.items() if key not in normalized
        },
        raw_payload=deepcopy(raw),
    )


def _classic_answer_from_canvas(raw: dict[str, Any]) -> Answer:
    weight = _first(raw, "weight", "answer_weight")
    is_correct = (
        weight == 100 if isinstance(weight, (int, float)) else raw.get("is_correct")
    )
    return Answer(
        answer_id=raw.get("id"),
        text_html=_string(_first(raw, "html", "text", "answer_html", "answer_text")),
        weight=weight,
        is_correct=is_correct,
        comments_html=_optional_string(
            _first(
                raw,
                "comments_html",
                "comments",
                "answer_comments_html",
                "answer_comments",
            )
        ),
        raw_payload=deepcopy(raw),
    )


def _new_quiz_from_canvas(
    quiz_raw: dict[str, Any],
    item_raws: Iterable[dict[str, Any]],
    *,
    assignment_id: int | str,
    write_enabled: bool,
) -> Quiz:
    questions = [_new_question_from_canvas(raw) for raw in item_raws]
    clean_quiz_raw = deepcopy(quiz_raw)
    read_only_reason = None
    if not write_enabled:
        read_only_reason = (
            "New Quiz write-back is disabled until its live fidelity spike passes"
        )
    return Quiz(
        # New Quiz endpoints are keyed by the associated assignment ID supplied by
        # the module item. Keep the response's own ID untouched in raw_payload.
        quiz_id=assignment_id,
        engine="new",
        title=str(quiz_raw.get("title", "")),
        description_html=_string(quiz_raw.get("instructions")),
        points_possible=quiz_raw.get("points_possible"),
        question_count=len(questions),
        questions=questions,
        raw_payload=clean_quiz_raw,
        read_only_reason=read_only_reason,
    )


def _new_question_from_canvas(raw: dict[str, Any]) -> Question:
    entry = raw.get("entry") if isinstance(raw.get("entry"), dict) else {}
    entry_type = str(raw.get("entry_type", "Unknown"))
    is_question = entry_type == "Item"
    question_type = str(entry.get("interaction_type_slug") or f"canvas:{entry_type}")
    stem = (
        entry.get("item_body")
        if is_question
        else entry.get("body", entry.get("instructions"))
    )
    answers = _new_answers_from_canvas(entry) if is_question else []
    read_only_reason = None
    if not is_question:
        read_only_reason = (
            f"Canvas New Quiz {entry_type} items are read-only in the public API"
        )
    return Question(
        question_id=_required(raw, "id"),
        position=_integer(raw.get("position"), 0),
        question_type=question_type,
        stem_html=_string(stem),
        points_possible=raw.get("points_possible"),
        answers=answers,
        type_specific=deepcopy(raw),
        raw_payload=deepcopy(raw),
        read_only_reason=read_only_reason,
    )


def _new_answers_from_canvas(entry: dict[str, Any]) -> list[Answer]:
    interaction = entry.get("interaction_data")
    choices = interaction.get("choices") if isinstance(interaction, dict) else None
    if not isinstance(choices, list):
        return []
    correct_ids = _new_correct_ids(entry.get("scoring_data"))
    feedback = entry.get("answer_feedback")
    feedback = feedback if isinstance(feedback, dict) else {}
    answers: list[Answer] = []
    for choice in choices:
        if not isinstance(choice, dict):
            continue
        answer_id = choice.get("id")
        is_correct = str(answer_id) in correct_ids if answer_id is not None else None
        answers.append(
            Answer(
                answer_id=answer_id,
                text_html=_string(_first(choice, "itemBody", "item_body", "text")),
                weight=100 if is_correct else 0,
                is_correct=is_correct,
                comments_html=_optional_string(feedback.get(str(answer_id))),
                raw_payload=deepcopy(choice),
            )
        )
    return answers


def _new_correct_ids(scoring_data: Any) -> set[str]:
    if not isinstance(scoring_data, dict):
        return set()
    value = scoring_data.get("value")
    if isinstance(value, (str, int)):
        return {str(value)}
    if isinstance(value, list):
        return {str(item) for item in value if isinstance(item, (str, int))}
    if isinstance(value, dict):
        return {str(item) for item in value.values() if isinstance(item, (str, int))}
    return set()


def _file_from_canvas(raw: dict[str, Any]) -> FileRef:
    return FileRef(
        file_id=_required(raw, "id"),
        display_name=str(raw.get("display_name") or raw.get("filename") or ""),
        content_type=_optional_string(raw.get("content-type", raw.get("content_type"))),
        url=_string(raw.get("url", raw.get("download_url"))),
        raw_payload=deepcopy(raw),
    )


def _file_from_module_item(raw: dict[str, Any]) -> FileRef:
    details = (
        raw.get("content_details")
        if isinstance(raw.get("content_details"), dict)
        else {}
    )
    return FileRef(
        file_id=raw.get("content_id", raw["id"]),
        display_name=str(raw.get("title", "")),
        content_type=_optional_string(details.get("content_type")),
        url=_string(raw.get("url", raw.get("external_url"))),
        raw_payload=deepcopy(details),
    )


def _export_page(page: Page) -> dict[str, Any]:
    payload = deepcopy(page.raw_payload)
    _set_alias(payload, ("url", "page_url"), page.page_url, default="url")
    if page.page_id is not None:
        _set_alias(payload, ("page_id", "id"), page.page_id, default="page_id")
    _set(payload, "title", page.title)
    _set_text_preserving_null(payload, "body", page.body_html)
    if page.published is not None:
        _set(payload, "published", page.published)
    if page.front_page is not None:
        _set(payload, "front_page", page.front_page)
    return payload


def _export_quiz(quiz: Quiz) -> dict[str, Any]:
    payload = deepcopy(quiz.raw_payload)
    _set(payload, "id", quiz.quiz_id)
    _set(payload, "title", quiz.title)
    _set_text_preserving_null(
        payload,
        "description" if quiz.engine == "classic" else "instructions",
        quiz.description_html,
    )
    if quiz.points_possible is not None:
        _set(payload, "points_possible", quiz.points_possible)
    if "question_count" in payload:
        _set(payload, "question_count", quiz.question_count)
    return payload


def _export_question(question: Question, engine: str) -> dict[str, Any]:
    if engine == "new":
        return _export_new_question(question)
    payload = deepcopy(question.raw_payload)
    payload.update(deepcopy(question.type_specific))
    _set(payload, "id", question.question_id)
    _set(payload, "position", question.position)
    _set(payload, "question_type", question.question_type)
    _set_text_preserving_null(payload, "question_text", question.stem_html)
    if question.points_possible is not None:
        _set(payload, "points_possible", question.points_possible)
    _set(
        payload,
        "answers",
        [_export_classic_answer(answer) for answer in question.answers],
    )
    return payload


def _export_classic_answer(answer: Answer) -> dict[str, Any]:
    payload = deepcopy(answer.raw_payload)
    if answer.answer_id is not None:
        _set(payload, "id", answer.answer_id)
    _set_alias_text_preserving_null(
        payload,
        ("html", "text", "answer_html", "answer_text"),
        answer.text_html,
        default="text",
    )
    weight = answer.weight
    if answer.is_correct is True and weight != 100:
        weight = 100
    elif answer.is_correct is False and weight == 100:
        weight = 0
    if weight is not None:
        _set_alias(payload, ("weight", "answer_weight"), weight, default="weight")
    if answer.comments_html is not None:
        _set_alias(
            payload,
            ("comments_html", "comments", "answer_comments_html", "answer_comments"),
            answer.comments_html,
            default="comments",
        )
    return payload


def _export_new_question(question: Question) -> dict[str, Any]:
    payload = deepcopy(question.raw_payload)
    payload.update(deepcopy(question.type_specific))
    _set(payload, "id", question.question_id)
    _set(payload, "position", question.position)
    if question.points_possible is not None:
        _set(payload, "points_possible", question.points_possible)
    entry = payload.get("entry")
    if not isinstance(entry, dict) or payload.get("entry_type") != "Item":
        return payload
    _set(entry, "interaction_type_slug", question.question_type)
    _set_text_preserving_null(entry, "item_body", question.stem_html)
    interaction = entry.get("interaction_data")
    if isinstance(interaction, dict) and isinstance(interaction.get("choices"), list):
        by_id = {str(answer.answer_id): answer for answer in question.answers}
        choices = []
        for choice in interaction["choices"]:
            current = deepcopy(choice)
            if isinstance(current, dict) and str(current.get("id")) in by_id:
                answer = by_id[str(current.get("id"))]
                _set_alias_text_preserving_null(
                    current,
                    ("itemBody", "item_body", "text"),
                    answer.text_html,
                    default="itemBody",
                )
            choices.append(current)
        interaction["choices"] = choices
        correct_ids = [
            answer.answer_id
            for answer in question.answers
            if answer.is_correct is True and answer.answer_id is not None
        ]
        scoring_data = entry.get("scoring_data")
        if isinstance(scoring_data, dict) and correct_ids:
            original_value = scoring_data.get("value")
            scoring_data["value"] = (
                correct_ids
                if isinstance(original_value, list) or len(correct_ids) > 1
                else correct_ids[0]
            )
        answer_feedback = entry.get("answer_feedback")
        if isinstance(answer_feedback, dict):
            for answer in question.answers:
                if answer.answer_id is not None and answer.comments_html is not None:
                    answer_feedback[str(answer.answer_id)] = answer.comments_html
    return payload


def _export_file(file: FileRef) -> dict[str, Any]:
    payload = deepcopy(file.raw_payload)
    _set(payload, "id", file.file_id)
    _set_alias(
        payload,
        ("display_name", "filename", "title"),
        file.display_name,
        default="display_name",
    )
    if file.content_type is not None:
        _set_alias(
            payload,
            ("content-type", "content_type"),
            file.content_type,
            default="content-type",
        )
    if file.url:
        _set_alias(payload, ("url", "download_url"), file.url, default="url")
    return payload


def _snapshot(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return _json_safe(value)
    try:
        attributes = vars(value)
    except TypeError as exc:
        raise CanvasImportError(
            f"Canvas returned an unsupported {type(value).__name__} object"
        ) from exc
    return {
        key: _json_safe(item)
        for key, item in attributes.items()
        if not key.startswith("_") and not callable(item)
    }


def _json_safe(value: Any) -> Any:
    """Return a JSON-serializable deep copy.

    ``canvasapi`` decorates its objects with ``datetime`` values (e.g. the
    ``*_date`` fields it derives from Canvas' ISO strings). Those cannot be
    persisted to the ``jsonb`` scratchpad columns as-is, so every snapshot is
    normalized to JSON-native types before it becomes a ``raw_payload``.
    """

    if isinstance(value, dict):
        return {str(key): _json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(item) for item in value]
    if isinstance(value, bool) or value is None or isinstance(value, (str, int, float)):
        return value
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    # Last resort: never let an unexpected type break persistence.
    return str(value)


def _classified_import_error(exc: Exception, fallback: str) -> CanvasImportError:
    status = _status_code(exc)
    name = type(exc).__name__.lower()
    if status in (401, 403) or "invalidaccesstoken" in name or "unauthorized" in name:
        return CanvasAuthenticationError(
            "Canvas authorization failed; reconnect and verify API scopes"
        )
    if status == 429:
        return CanvasRateLimitError(
            "Canvas rate-limited the import; retry after the server delay"
        )
    if isinstance(exc, (CanvasOverallTimeout, requests.Timeout)) or "timeout" in name:
        return CanvasTimeoutError("Canvas did not finish within the allowed time")
    if isinstance(exc, requests.ConnectionError):
        return CanvasUnreachableError("Canvas could not be reached")
    return CanvasImportError(fallback)


def _safe_failure_message(exc: Exception) -> str:
    classified = _classified_import_error(exc, "Canvas resource could not be imported")
    return str(classified)


def _is_not_found(exc: Exception) -> bool:
    return (
        _status_code(exc) == 404 or "resourcedoesnotexist" in type(exc).__name__.lower()
    )


def _status_code(exc: Exception) -> int | None:
    status = getattr(exc, "status_code", None)
    if isinstance(status, int):
        return status
    response = getattr(exc, "response", None)
    status = getattr(response, "status_code", None)
    return status if isinstance(status, int) else None


def _required(data: dict[str, Any], key: str) -> Any:
    value = data.get(key)
    if value is None:
        raise CanvasImportError(f"Canvas response is missing required field {key!r}")
    return value


def _integer(value: Any, default: int) -> int:
    if value is None:
        return default
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise CanvasImportError(f"Canvas position {value!r} is not an integer") from exc


def _string(value: Any) -> str:
    return value if isinstance(value, str) else ""


def _optional_string(value: Any) -> str | None:
    return value if isinstance(value, str) else None


def _first(data: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in data and data[key] is not None:
            return data[key]
    return None


def _set(data: dict[str, Any], key: str, value: Any) -> None:
    data[key] = deepcopy(value)


def _set_alias(
    data: dict[str, Any], keys: tuple[str, ...], value: Any, *, default: str
) -> None:
    existing = next((key for key in keys if key in data), default)
    data[existing] = deepcopy(value)


def _set_text_preserving_null(data: dict[str, Any], key: str, value: str) -> None:
    if key in data and data[key] is None and value == "":
        return
    _set(data, key, value)


def _set_alias_text_preserving_null(
    data: dict[str, Any], keys: tuple[str, ...], value: str, *, default: str
) -> None:
    existing = next((key for key in keys if key in data), default)
    if existing in data and data[existing] is None and value == "":
        return
    data[existing] = deepcopy(value)
