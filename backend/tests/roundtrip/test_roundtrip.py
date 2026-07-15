from __future__ import annotations

import json
from copy import deepcopy

import pytest

from canvas_import.canvas.adapter import CanvasAdapter, PartialImportError
from canvas_import.store import WorkingCopyStore

from .conftest import FakeCanvas, FakeNewQuizClient


def test_two_course_import_store_and_dry_run_are_lossless(canvas_fixture, tmp_path):
    canvas = FakeCanvas(canvas_fixture)
    new_quizzes = FakeNewQuizClient(canvas_fixture, canvas.calls)
    adapter = CanvasAdapter(canvas, new_quiz_client=new_quizzes)

    course = adapter.import_course(canvas_fixture["course"]["id"])
    path = tmp_path / "working-copy.json"
    metadata = WorkingCopyStore().save(course, path)
    restored = WorkingCopyStore().load(path)

    assert adapter.export_dry_run(restored) == canvas_fixture
    assert restored.to_dict() == course.to_dict()
    assert metadata.delete_after > metadata.created_at
    assert oct(path.stat().st_mode & 0o777) == "0o600"


def test_raw_html_is_preserved_byte_for_byte(canvas_fixture, tmp_path):
    canvas = FakeCanvas(canvas_fixture)
    adapter = CanvasAdapter(
        canvas,
        new_quiz_client=FakeNewQuizClient(canvas_fixture, canvas.calls),
    )
    imported = adapter.import_course(canvas_fixture["course"]["id"])
    page = next(
        item.page for module in imported.modules for item in module.items if item.page
    )
    expected = next(
        item["content"]["page"]["body"]
        for module in canvas_fixture["modules"]
        for item in module["items"]
        if item["content"]["kind"] == "page"
    )

    path = tmp_path / "raw-html.json"
    WorkingCopyStore().save(imported, path)
    restored = WorkingCopyStore().load(path)
    restored_page = next(
        item.page for module in restored.modules for item in module.items if item.page
    )

    assert page.body_html.encode() == expected.encode()
    assert restored_page.body_html.encode() == expected.encode()


def test_import_never_issues_a_write(canvas_fixture):
    canvas = FakeCanvas(canvas_fixture)
    adapter = CanvasAdapter(
        canvas,
        new_quiz_client=FakeNewQuizClient(canvas_fixture, canvas.calls),
    )

    adapter.import_course(canvas_fixture["course"]["id"])

    assert canvas.calls
    assert {method for method, _ in canvas.calls} == {"GET"}


def test_unsupported_items_are_preserved_as_opaque(canvas_fixture):
    canvas = FakeCanvas(canvas_fixture)
    adapter = CanvasAdapter(
        canvas,
        new_quiz_client=FakeNewQuizClient(canvas_fixture, canvas.calls),
    )
    course = adapter.import_course(canvas_fixture["course"]["id"])

    opaque_items = [
        item
        for module in course.modules
        for item in module.items
        if item.kind == "opaque"
    ]

    assert opaque_items
    for item in opaque_items:
        assert item.opaque == item.raw_payload


def test_classic_correct_answers_and_new_read_only_boundaries(canvas_fixture):
    canvas = FakeCanvas(canvas_fixture)
    adapter = CanvasAdapter(
        canvas,
        new_quiz_client=FakeNewQuizClient(canvas_fixture, canvas.calls),
    )
    course = adapter.import_course(canvas_fixture["course"]["id"])
    quiz = next(
        item.quiz for module in course.modules for item in module.items if item.quiz
    )

    if quiz.engine == "classic":
        assert quiz.questions[0].answers[0].is_correct is True
        assert quiz.questions[0].answers[1].is_correct is False
        assert quiz.editable is True
    else:
        assert quiz.questions[0].answers[1].is_correct is True
        assert quiz.questions[1].read_only_reason is not None
        assert quiz.read_only_reason is not None
        assert quiz.editable is False


def test_partial_resource_failure_is_never_silent(canvas_fixture):
    broken = deepcopy(canvas_fixture)
    page = next(
        item
        for module in broken["modules"]
        for item in module["items"]
        if item["content"]["kind"] == "page"
    )
    page["module_item"]["page_url"] = "missing-page"
    canvas = FakeCanvas(broken)
    adapter = CanvasAdapter(
        canvas, new_quiz_client=FakeNewQuizClient(broken, canvas.calls)
    )

    with pytest.raises(PartialImportError) as caught:
        adapter.import_course(broken["course"]["id"])

    assert caught.value.issues[0].phase == "module_item"
    assert any(item.kind == "opaque" for item in caught.value.course.modules[0].items)


def test_saved_document_contains_retention_metadata(canvas_fixture, tmp_path):
    canvas = FakeCanvas(canvas_fixture)
    adapter = CanvasAdapter(
        canvas,
        new_quiz_client=FakeNewQuizClient(canvas_fixture, canvas.calls),
    )
    course = adapter.import_course(canvas_fixture["course"]["id"])
    path = tmp_path / "working-copy.json"
    WorkingCopyStore(retention_days=30).save(course, path)

    envelope = json.loads(path.read_text(encoding="utf-8"))

    assert envelope["schema_version"] == 1
    assert envelope["created_at"]
    assert envelope["delete_after"]
    assert "access_token" not in envelope


def test_reverse_mapping_includes_page_and_classic_grading_edits():
    from pathlib import Path

    fixture = json.loads(
        (Path(__file__).parents[1] / "fixtures" / "course_classic.json").read_text(
            encoding="utf-8"
        )
    )
    canvas = FakeCanvas(fixture)
    adapter = CanvasAdapter(
        canvas, new_quiz_client=FakeNewQuizClient(fixture, canvas.calls)
    )
    course = adapter.import_course(fixture["course"]["id"])
    page = course.modules[0].items[0].page
    quiz = course.modules[0].items[1].quiz
    assert page is not None and quiz is not None
    page.body_html = "<p>Edited page</p>"
    question = quiz.questions[0]
    question.stem_html = "<p>Edited stem</p>"
    question.points_possible = 3
    question.answers[0].is_correct = False
    question.answers[1].is_correct = True

    snapshot = adapter.export_dry_run(course)
    page_payload = snapshot["modules"][0]["items"][0]["content"]["page"]
    question_payload = snapshot["modules"][0]["items"][1]["content"]["questions"][0]

    assert page_payload["body"] == "<p>Edited page</p>"
    assert question_payload["question_text"] == "<p>Edited stem</p>"
    assert question_payload["points_possible"] == 3
    assert [answer["weight"] for answer in question_payload["answers"]] == [0, 100]


def test_reverse_mapping_includes_new_quiz_choice_and_correct_answer_edits():
    from pathlib import Path

    fixture = json.loads(
        (Path(__file__).parents[1] / "fixtures" / "course_new_quiz.json").read_text(
            encoding="utf-8"
        )
    )
    canvas = FakeCanvas(fixture)
    adapter = CanvasAdapter(
        canvas,
        new_quiz_client=FakeNewQuizClient(fixture, canvas.calls),
        new_quizzes_editable=True,
    )
    course = adapter.import_course(fixture["course"]["id"])
    quiz = course.modules[0].items[1].quiz
    assert quiz is not None
    question = quiz.questions[0]
    question.stem_html = "<p>Edited New Quiz stem</p>"
    question.answers[0].text_html = "<p>Edited choice</p>"
    question.answers[0].is_correct = True
    question.answers[1].is_correct = False

    snapshot = adapter.export_dry_run(course)
    payload = snapshot["modules"][0]["items"][1]["content"]["questions"][0]

    assert payload["entry"]["item_body"] == "<p>Edited New Quiz stem</p>"
    assert (
        payload["entry"]["interaction_data"]["choices"][0]["itemBody"]
        == "<p>Edited choice</p>"
    )
    assert payload["entry"]["scoring_data"]["value"] == "choice-a"


def test_blank_canvas_html_nulls_are_not_normalized_to_empty_strings():
    from pathlib import Path

    fixture = json.loads(
        (Path(__file__).parents[1] / "fixtures" / "course_classic.json").read_text(
            encoding="utf-8"
        )
    )
    fixture["modules"][0]["items"][0]["content"]["page"]["body"] = None
    quiz_content = fixture["modules"][0]["items"][1]["content"]
    quiz_content["quiz"]["description"] = None
    quiz_content["questions"][0]["question_text"] = None
    quiz_content["questions"][0]["answers"][0]["html"] = None
    canvas = FakeCanvas(fixture)
    adapter = CanvasAdapter(
        canvas, new_quiz_client=FakeNewQuizClient(fixture, canvas.calls)
    )

    course = adapter.import_course(fixture["course"]["id"])

    assert adapter.export_dry_run(course) == fixture
