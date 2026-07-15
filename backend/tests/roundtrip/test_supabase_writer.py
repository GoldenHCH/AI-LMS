from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

import pytest
from supabase import create_client

from canvas_import.fixture_loader import load_fixture_course
from canvas_import.persistence import SupabaseCourseWriter

from .conftest import FIXTURES


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

    def execute(self):
        if self.operation == "delete":
            self.client.deletes.append((self.table, self.filters.copy()))
            return FakeResponse([])
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

    course_id = SupabaseCourseWriter(client).write(course)  # type: ignore[arg-type]

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


def test_writer_requests_cascade_cleanup_after_a_partial_failure():
    course = load_fixture_course(FIXTURES / "course_classic.json")
    client = FakeSupabase(fail_table="pages")

    with pytest.raises(RuntimeError, match="forced pages failure"):
        SupabaseCourseWriter(client).write(course)  # type: ignore[arg-type]

    inserted_course_id = client.rows["courses"][0]["id"]
    assert ("courses", {"id": inserted_course_id}) in client.deletes


@pytest.mark.live
@pytest.mark.parametrize("fixture_name", ["course_classic.json", "course_new_quiz.json"])
def test_live_supabase_writer_preserves_structure_and_grading(fixture_name: str):
    if os.getenv("RUN_SUPABASE_LIVE_TESTS") != "1":
        pytest.skip("set RUN_SUPABASE_LIVE_TESTS=1 to mutate the Supabase dev project")
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if not url or not key:
        pytest.skip("requires the public Supabase URL and key")

    course = load_fixture_course(FIXTURES / fixture_name)
    course.canvas_course_id = f"writer-test-{course.canvas_course_id}"
    client = create_client(url, key)
    course_id = SupabaseCourseWriter(client).write(course)

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
