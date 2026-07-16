"""Persist the lossless Canvas course model to the Supabase scratchpad schema."""

from __future__ import annotations

import os
import uuid
from datetime import datetime
from typing import Any, Mapping, Sequence

from supabase import Client, create_client

from ..model import Answer, Course, FileRef, ModuleItem, Page, Question, Quiz


class SupabasePersistenceError(RuntimeError):
    """Raised when Supabase returns an unexpected persistence response."""


class SupabaseCourseWriter:
    """Replace one imported course with a complete relational scratchpad tree.

    The complete new tree is written before the previous workspace-scoped tree is
    deleted. A child failure therefore cleans up only the new row and leaves the
    professor's prior scratchpad intact.
    """

    def __init__(
        self,
        client: Client | None = None,
        *,
        url: str | None = None,
        key: str | None = None,
    ) -> None:
        if client is not None:
            self.client = client
            return

        resolved_url = url or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
        resolved_key = key or os.getenv("SUPABASE_SECRET_KEY")
        if not resolved_url or not resolved_key:
            raise ValueError(
                "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY"
            )
        if resolved_key.startswith("sb_publishable_"):
            raise ValueError("Supabase persistence requires a server secret key")
        self.client = create_client(resolved_url, resolved_key)

    def write(
        self,
        course: Course,
        *,
        workspace_id: str,
        expires_at: datetime,
        import_issues: Sequence[Any] = (),
    ) -> str:
        """Replace and persist ``course``, returning its generated UUID."""

        try:
            workspace_id = str(uuid.UUID(workspace_id))
        except (TypeError, ValueError, AttributeError) as exc:
            raise ValueError("workspace_id must be a UUID") from exc
        if expires_at.tzinfo is None or expires_at.utcoffset() is None:
            raise ValueError("expires_at must be timezone-aware")
        canvas_course_id = _canvas_id(course.canvas_course_id)
        prior_response = (
            self.client.table("courses")
            .select("id")
            .eq("workspace_id", workspace_id)
            .eq("canvas_course_id", canvas_course_id)
            .execute()
        )
        prior_rows = prior_response.data
        if not isinstance(prior_rows, list) or any(
            not isinstance(row, dict) or not isinstance(row.get("id"), str)
            for row in prior_rows
        ):
            raise SupabasePersistenceError(
                "Could not identify the previous imported course"
            )
        prior_ids = [row["id"] for row in prior_rows]
        issues = [_sanitized_issue(issue) for issue in import_issues][:100]

        course_id: str | None = None
        try:
            course_row = self._insert_one(
                "courses",
                {
                    "canvas_course_id": canvas_course_id,
                    "name": course.name,
                    "workspace_id": workspace_id,
                    "expires_at": expires_at.isoformat(),
                    "import_status": "partial" if issues else "complete",
                    "import_issues": issues,
                    "raw_payload": course.raw_payload,
                },
            )
            course_id = _required_uuid(course_row, "courses")

            for module in sorted(course.modules, key=lambda entry: entry.position):
                module_row = self._insert_one(
                    "modules",
                    {
                        "course_id": course_id,
                        "canvas_module_id": _canvas_id(module.canvas_module_id),
                        "name": module.name,
                        "position": module.position,
                        "raw_payload": module.raw_payload,
                    },
                )
                module_id = _required_uuid(module_row, "modules")

                for item in sorted(module.items, key=lambda entry: entry.position):
                    item_row = self._insert_one(
                        "module_items",
                        {
                            "module_id": module_id,
                            "canvas_module_item_id": _canvas_id(
                                item.canvas_module_item_id
                            ),
                            "position": item.position,
                            "kind": item.kind,
                            "opaque": item.opaque if item.kind == "opaque" else None,
                            "links": item.links,
                            "raw_payload": item.raw_payload,
                        },
                    )
                    module_item_id = _required_uuid(item_row, "module_items")
                    self._write_item_detail(course_id, module_item_id, item)

            if course.files:
                self._insert_many(
                    "files",
                    [
                        _file_payload(file, course_id=course_id, module_item_id=None)
                        for file in course.files
                    ],
                )

            if prior_ids:
                self.client.table("courses").delete().in_("id", prior_ids).execute()
        except Exception as exc:
            if course_id is not None:
                try:
                    self.client.table("courses").delete().eq("id", course_id).execute()
                except Exception as cleanup_error:  # pragma: no cover - network edge
                    exc.add_note(
                        "Supabase cleanup also failed: "
                        f"{type(cleanup_error).__name__}: {cleanup_error}"
                    )
            raise

        return course_id

    def _write_item_detail(
        self, course_id: str, module_item_id: str, item: ModuleItem
    ) -> None:
        if item.page is not None:
            self._insert_one("pages", _page_payload(item.page, module_item_id))
            return
        if item.quiz is not None:
            self._write_quiz(item.quiz, module_item_id)
            return
        if item.file is not None:
            self._insert_one(
                "files",
                _file_payload(
                    item.file,
                    course_id=course_id,
                    module_item_id=module_item_id,
                ),
            )

    def _write_quiz(self, quiz: Quiz, module_item_id: str) -> None:
        quiz_row = self._insert_one(
            "quizzes",
            {
                "module_item_id": module_item_id,
                "canvas_quiz_id": _canvas_id(quiz.quiz_id),
                "engine": quiz.engine,
                "title": quiz.title,
                "description_html": quiz.description_html,
                "points_possible": quiz.points_possible,
                "question_count": quiz.question_count,
                "links": quiz.links,
                "raw_payload": quiz.raw_payload,
                "read_only_reason": quiz.read_only_reason,
            },
        )
        quiz_id = _required_uuid(quiz_row, "quizzes")

        for question in sorted(quiz.questions, key=lambda entry: entry.position):
            question_row = self._insert_one(
                "quiz_questions", _question_payload(question, quiz_id)
            )
            question_id = _required_uuid(question_row, "quiz_questions")
            if question.answers:
                self._insert_many(
                    "quiz_answers",
                    [
                        _answer_payload(answer, question_id, ordinal)
                        for ordinal, answer in enumerate(question.answers)
                    ],
                )

    def _insert_one(self, table: str, payload: Mapping[str, Any]) -> dict[str, Any]:
        response = self.client.table(table).insert(dict(payload)).execute()
        data = response.data
        if not isinstance(data, list) or len(data) != 1 or not isinstance(data[0], dict):
            raise SupabasePersistenceError(
                f"Expected one inserted {table} row, received {data!r}"
            )
        return data[0]

    def _insert_many(
        self, table: str, payloads: Sequence[Mapping[str, Any]]
    ) -> list[dict[str, Any]]:
        rows = [dict(payload) for payload in payloads]
        if not rows:
            return []
        response = self.client.table(table).insert(rows).execute()
        data = response.data
        if not isinstance(data, list) or len(data) != len(rows):
            raise SupabasePersistenceError(
                f"Expected {len(rows)} inserted {table} rows, received {data!r}"
            )
        return data


def _canvas_id(value: int | str) -> str:
    return str(value)


def _sanitized_issue(issue: Any) -> dict[str, str | None]:
    if isinstance(issue, Mapping):
        phase = issue.get("phase")
        canvas_id = issue.get("canvasId", issue.get("canvas_id"))
        message = issue.get("message")
    else:
        phase = getattr(issue, "phase", None)
        canvas_id = getattr(issue, "canvas_id", None)
        message = getattr(issue, "message", None)
    return {
        "phase": _bounded_text(phase, 64, "resource"),
        "canvasId": (
            _bounded_text(canvas_id, 128, "unknown")
            if canvas_id is not None
            else None
        ),
        "message": _bounded_text(message, 160, "Canvas resource could not be imported"),
    }


def _bounded_text(value: Any, length: int, fallback: str) -> str:
    text = str(value) if value is not None else fallback
    return text[:length]


def _required_uuid(row: Mapping[str, Any], table: str) -> str:
    value = row.get("id")
    if not isinstance(value, str) or not value:
        raise SupabasePersistenceError(f"Inserted {table} row did not return an id")
    return value


def _page_payload(page: Page, module_item_id: str) -> dict[str, Any]:
    return {
        "module_item_id": module_item_id,
        "page_url": page.page_url,
        "canvas_page_id": (
            _canvas_id(page.page_id) if page.page_id is not None else None
        ),
        "title": page.title,
        "body_html": page.body_html,
        "published": page.published,
        "front_page": page.front_page,
        "links": page.links,
        "raw_payload": page.raw_payload,
    }


def _question_payload(question: Question, quiz_id: str) -> dict[str, Any]:
    return {
        "quiz_id": quiz_id,
        "canvas_question_id": _canvas_id(question.question_id),
        "position": question.position,
        "question_type": question.question_type,
        "stem_html": question.stem_html,
        "points_possible": question.points_possible,
        "type_specific": question.type_specific,
        "links": question.links,
        "raw_payload": question.raw_payload,
        "read_only_reason": question.read_only_reason,
    }


def _answer_payload(
    answer: Answer, question_id: str, ordinal: int
) -> dict[str, Any]:
    return {
        "question_id": question_id,
        "canvas_answer_id": (
            _canvas_id(answer.answer_id) if answer.answer_id is not None else None
        ),
        "ordinal": ordinal,
        "text_html": answer.text_html,
        "weight": answer.weight,
        "is_correct": answer.is_correct,
        "comments_html": answer.comments_html,
        "raw_payload": answer.raw_payload,
    }


def _file_payload(
    file: FileRef, *, course_id: str, module_item_id: str | None
) -> dict[str, Any]:
    return {
        "course_id": course_id,
        "module_item_id": module_item_id,
        "canvas_file_id": _canvas_id(file.file_id),
        "display_name": file.display_name,
        "content_type": file.content_type,
        "url": file.url,
        "links": file.links,
        "raw_payload": file.raw_payload,
    }
