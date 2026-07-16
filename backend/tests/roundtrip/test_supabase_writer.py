from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from supabase import create_client

from canvas_import.fixture_loader import load_fixture_course
from canvas_import.persistence import SupabaseCourseWriter

from .conftest import FIXTURES

WORKSPACE_ID = "11111111-1111-4111-8111-111111111111"
OTHER_WORKSPACE_ID = "22222222-2222-4222-8222-222222222222"
EXPIRES_AT = datetime(2026, 7, 15, 23, 59, tzinfo=UTC)


@dataclass
class FakeResponse:
    data: list[dict[str, Any]]


class FakeQuery:
    def __init__(self, client: "FakeSupabase", table: str) -> None:
        self.client = client
        self.table = table
        self.operation = ""
        self.payload: dict[str, Any] | list[dict[str, Any]] | None = None
        self.filters: dict[str, Any] = {}
        self.in_filters: dict[str, list[Any]] = {}

    def select(self, _columns: str):
        self.operation = "select"
        return self

    def insert(self, payload):
        self.operation = "insert"
        self.payload = payload
        return self

    def delete(self):
        self.operation = "delete"
        return self

    def eq(self, column: str, value: Any):
        self.filters[column] = value
        return self

    def in_(self, column: str, values: list[Any]):
        self.in_filters[column] = values
        return self

    def execute(self):
        if self.operation == "delete":
            recorded = self.filters.copy()
            recorded.update({key: tuple(value) for key, value in self.in_filters.items()})
            self.client.deletes.append((self.table, recorded))
            self.client.rows[self.table] = [
                row
                for row in self.client.rows.get(self.table, [])
                if not self._matches(row)
            ]
            return FakeResponse([])
        if self.operation == "select":
            return FakeResponse(
                [
                    {"id": row["id"]}
                    for row in self.client.rows.get(self.table, [])
                    if self._matches(row)
                ]
            )
        if self.operation != "insert" or self.payload is None:
            raise AssertionError(f"Unexpected fake query operation: {self.operation}")
        if self.client.fail_table == self.table:
            raise RuntimeError(f"forced {self.table} failure")
        payloads = self.payload if isinstance(self.payload, list) else [self.payload]
        inserted = []
        for payload in payloads:
            self.client.next_id += 1
            row = {**payload, "id": f"00000000-0000-0000-0000-{self.client.next_id:012d}"}
            self.client.rows.setdefault(self.table, []).append(row)
            inserted.append(row)
        return FakeResponse(inserted)

    def _matches(self, row: dict[str, Any]) -> bool:
        return all(row.get(key) == value for key, value in self.filters.items()) and all(
            row.get(key) in values for key, values in self.in_filters.items()
        )


class FakeSupabase:
    def __init__(self, *, fail_table: str | None = None) -> None:
        self.fail_table = fail_table
        self.next_id = 0
        self.rows: dict[str, list[dict[str, Any]]] = {}
        self.deletes: list[tuple[str, dict[str, Any]]] = []

    def table(self, table: str):
        return FakeQuery(self, table)


def test_writer_maps_the_full_classic_fixture_offline():
    course = load_fixture_course(FIXTURES / "course_classic.json")
    client = FakeSupabase()

    course_id = SupabaseCourseWriter(client).write(  # type: ignore[arg-type]
        course,
        workspace_id=WORKSPACE_ID,
        expires_at=EXPIRES_AT,
    )

    assert course_id == client.rows["courses"][0]["id"]
    assert len(client.rows["modules"]) == 1
    assert len(client.rows["module_items"]) == 4
    assert len(client.rows["pages"]) == 1
    assert len(client.rows["quizzes"]) == 1
    assert len(client.rows["quiz_questions"]) == 1
    assert [row["ordinal"] for row in client.rows["quiz_answers"]] == [0, 1]
    assert [row["is_correct"] for row in client.rows["quiz_answers"]] == [True, False]
    assert len(client.rows["files"]) == 2
    assert sorted(row["module_item_id"] is None for row in client.rows["files"]) == [
        False,
        True,
    ]
    assert all(row["raw_payload"] for row in client.rows["module_items"])
    assert client.rows["courses"][0]["workspace_id"] == WORKSPACE_ID
    assert client.rows["courses"][0]["expires_at"] == EXPIRES_AT.isoformat()
    assert "canvas_base_url" not in client.rows["courses"][0]
    assert client.rows["courses"][0]["import_status"] == "complete"


def test_writer_requests_cascade_cleanup_after_a_partial_failure():
    course = load_fixture_course(FIXTURES / "course_classic.json")
    client = FakeSupabase(fail_table="pages")

    with pytest.raises(RuntimeError, match="forced pages failure"):
        SupabaseCourseWriter(client).write(  # type: ignore[arg-type]
            course,
            workspace_id=WORKSPACE_ID,
            expires_at=EXPIRES_AT,
        )

    cleanup_deletes = [filters for table, filters in client.deletes if table == "courses"]
    assert len(cleanup_deletes) == 1
    assert isinstance(cleanup_deletes[0].get("id"), str)


def test_failed_reimport_preserves_the_previous_tree():
    course = load_fixture_course(FIXTURES / "course_classic.json")
    client = FakeSupabase(fail_table="pages")
    old_id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    other_id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    client.rows["courses"] = [
        {
            "id": old_id,
            "workspace_id": WORKSPACE_ID,
            "canvas_course_id": str(course.canvas_course_id),
        },
        {
            "id": other_id,
            "workspace_id": OTHER_WORKSPACE_ID,
            "canvas_course_id": str(course.canvas_course_id),
        },
    ]

    with pytest.raises(RuntimeError, match="forced pages failure"):
        SupabaseCourseWriter(client).write(  # type: ignore[arg-type]
            course,
            workspace_id=WORKSPACE_ID,
            expires_at=EXPIRES_AT,
        )

    remaining_ids = {row["id"] for row in client.rows["courses"]}
    assert old_id in remaining_ids
    assert other_id in remaining_ids


def test_partial_issue_metadata_is_sanitized_and_persisted():
    course = load_fixture_course(FIXTURES / "course_classic.json")
    client = FakeSupabase()

    SupabaseCourseWriter(client).write(  # type: ignore[arg-type]
        course,
        workspace_id=WORKSPACE_ID,
        expires_at=EXPIRES_AT,
        import_issues=[
            {
                "phase": "module_item",
                "canvasId": "44",
                "message": "Canvas resource could not be imported",
            }
        ],
    )

    row = client.rows["courses"][0]
    assert row["import_status"] == "partial"
    assert row["import_issues"] == [
        {
            "phase": "module_item",
            "canvasId": "44",
            "message": "Canvas resource could not be imported",
        }
    ]


def test_successful_reimport_replaces_only_the_matching_origin_and_course():
    course = load_fixture_course(FIXTURES / "course_classic.json")
    client = FakeSupabase()
    old_id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    other_id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    client.rows["courses"] = [
        {
            "id": old_id,
            "workspace_id": WORKSPACE_ID,
            "canvas_course_id": str(course.canvas_course_id),
        },
        {
            "id": other_id,
            "workspace_id": OTHER_WORKSPACE_ID,
            "canvas_course_id": str(course.canvas_course_id),
        },
    ]

    new_id = SupabaseCourseWriter(client).write(  # type: ignore[arg-type]
        course,
        workspace_id=WORKSPACE_ID,
        expires_at=EXPIRES_AT,
    )

    remaining_ids = {row["id"] for row in client.rows["courses"]}
    assert old_id not in remaining_ids
    assert other_id in remaining_ids
    assert new_id in remaining_ids


def test_default_credentials_never_fall_back_to_a_publishable_key(monkeypatch):
    monkeypatch.delenv("SUPABASE_SECRET_KEY", raising=False)
    monkeypatch.setenv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "sb_publishable_not-secret")

    with pytest.raises(ValueError, match="SUPABASE_SECRET_KEY"):
        SupabaseCourseWriter()
    with pytest.raises(ValueError, match="server secret key"):
        SupabaseCourseWriter(
            url="https://example.supabase.co", key="sb_publishable_not-secret"
        )


@pytest.mark.live
@pytest.mark.parametrize("fixture_name", ["course_classic.json", "course_new_quiz.json"])
def test_live_supabase_writer_preserves_structure_and_grading(fixture_name: str):
    if os.getenv("RUN_SUPABASE_LIVE_TESTS") != "1":
        pytest.skip("set RUN_SUPABASE_LIVE_TESTS=1 to mutate the Supabase dev project")
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SECRET_KEY")
    if not url or not key:
        pytest.skip("requires the Supabase URL and secret key")

    course = load_fixture_course(FIXTURES / fixture_name)
    course.canvas_course_id = f"writer-test-{course.canvas_course_id}"
    client = create_client(url, key)
    course_id = SupabaseCourseWriter(client).write(
        course,
        workspace_id=WORKSPACE_ID,
        expires_at=datetime.now(UTC) + timedelta(minutes=30),
    )

    try:
        modules = (
            client.table("modules")
            .select("id,canvas_module_id,position,raw_payload")
            .eq("course_id", course_id)
            .order("position")
            .execute()
            .data
        )
        module_ids = [row["id"] for row in modules]
        items = (
            client.table("module_items")
            .select("id,module_id,canvas_module_item_id,kind,position,raw_payload")
            .in_("module_id", module_ids)
            .order("position")
            .execute()
            .data
        )
        item_ids = [row["id"] for row in items]
        pages = (
            client.table("pages")
            .select("module_item_id,body_html,raw_payload")
            .in_("module_item_id", item_ids)
            .execute()
            .data
        )
        quizzes = (
            client.table("quizzes")
            .select("id,module_item_id,engine,question_count,raw_payload")
            .in_("module_item_id", item_ids)
            .execute()
            .data
        )
        quiz_ids = [row["id"] for row in quizzes]
        questions = (
            client.table("quiz_questions")
            .select(
                "id,quiz_id,canvas_question_id,position,points_possible,"
                "read_only_reason,raw_payload"
            )
            .in_("quiz_id", quiz_ids)
            .order("position")
            .execute()
            .data
        )
        question_ids = [row["id"] for row in questions]
        answers = (
            client.table("quiz_answers")
            .select("question_id,ordinal,is_correct,weight,raw_payload")
            .in_("question_id", question_ids)
            .order("ordinal")
            .execute()
            .data
        )
        files = (
            client.table("files")
            .select("module_item_id,canvas_file_id,raw_payload")
            .eq("course_id", course_id)
            .execute()
            .data
        )

        model_items = [item for module in course.modules for item in module.items]
        model_quizzes = [item.quiz for item in model_items if item.quiz is not None]
        model_questions = [
            question for quiz in model_quizzes for question in quiz.questions
        ]
        model_answers = [
            answer for question in model_questions for answer in question.answers
        ]
        model_module_files = sum(item.file is not None for item in model_items)

        assert len(modules) == len(course.modules)
        assert len(items) == len(model_items)
        assert len(pages) == sum(item.page is not None for item in model_items)
        assert len(quizzes) == len(model_quizzes)
        assert len(questions) == len(model_questions)
        assert len(answers) == len(model_answers)
        assert len(files) == len(course.files) + model_module_files
        assert sorted(row["question_count"] for row in quizzes) == sorted(
            quiz.question_count for quiz in model_quizzes
        )
        assert sorted(
            (row["is_correct"], row["weight"]) for row in answers
        ) == sorted((answer.is_correct, answer.weight) for answer in model_answers)
        assert all(row["raw_payload"] for row in modules)
        assert all(row["raw_payload"] for row in items)
    finally:
        client.table("courses").delete().eq("id", course_id).execute()
