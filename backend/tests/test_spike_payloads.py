from __future__ import annotations

import json
import sys
from copy import deepcopy

from spikes.quiz_writeback import classic as classic_probe
from spikes.quiz_writeback.common import (
    classic_question_payload,
    diff_paths,
    new_item_payload,
)
from spikes.quiz_writeback.new import _mutated_payload


def test_classic_payload_uses_documented_write_field_names():
    payload = classic_question_payload(
        {
            "id": "1",
            "question_text": "<p>Stem</p>",
            "question_type": "multiple_choice_question",
            "points_possible": 2,
            "answers": [
                {"id": "a", "html": "<p>A</p>", "weight": 100, "comments_html": "ok"}
            ],
        }
    )

    assert payload["answers"] == [
        {
            "id": "a",
            "answer_text": "<p>A</p>",
            "answer_weight": 100,
            "answer_comments": "ok",
        }
    ]


def test_new_probe_mutates_all_four_required_fields_without_touching_source():
    original = new_item_payload(
        {
            "id": "1",
            "position": 1,
            "points_possible": 2,
            "entry_type": "Item",
            "entry": {
                "item_body": "<p>Stem</p>",
                "interaction_type_slug": "choice",
                "interaction_data": {
                    "choices": [
                        {"id": "a", "itemBody": "A"},
                        {"id": "b", "itemBody": "B"},
                    ]
                },
                "scoring_data": {"value": "a"},
                "scoring_algorithm": "Equivalence",
            },
        }
    )

    mutated = _mutated_payload(original)

    assert original["points_possible"] == 2
    assert mutated["points_possible"] == 3
    assert mutated["entry"]["item_body"] != original["entry"]["item_body"]
    assert (
        mutated["entry"]["interaction_data"]["choices"][0]
        != original["entry"]["interaction_data"]["choices"][0]
    )
    assert mutated["entry"]["scoring_data"]["value"] == "b"
    assert diff_paths(original, mutated)


def test_classic_probe_ui_pause_records_confirmations_and_restores(
    monkeypatch, tmp_path
):
    original = {
        "question_text": "<p>Stem</p>",
        "question_type": "multiple_choice_question",
        "points_possible": 1,
        "answers": [
            {"id": "a", "answer_text": "A", "answer_weight": 100},
            {"id": "b", "answer_text": "B", "answer_weight": 0},
        ],
    }

    class FakeQuestion:
        def __init__(self, quiz):
            self._quiz = quiz
            self._load()

        def _load(self):
            for key, value in self._quiz.payload.items():
                setattr(self, key, deepcopy(value))
            self.id = "question-1"

        def edit(self, *, question):
            self._quiz.payload = deepcopy(question)
            self._load()

    class FakeQuiz:
        published = False

        def __init__(self):
            self.payload = deepcopy(original)

        def get_questions(self):
            return [FakeQuestion(self)]

        def get_question(self, _question_id):
            return FakeQuestion(self)

    class FakeCourse:
        def __init__(self, quiz):
            self.quiz = quiz

        def get_quiz(self, _quiz_id):
            return self.quiz

    class FakeCanvas:
        def __init__(self, quiz):
            self.course = FakeCourse(quiz)

        def get_course(self, _course_id):
            return self.course

    quiz = FakeQuiz()
    canvas = FakeCanvas(quiz)
    report_path = tmp_path / "classic.json"
    confirmations = iter(
        [classic_probe.EDIT_UI_CONFIRMATION, classic_probe.RESTORE_UI_CONFIRMATION]
    )
    monkeypatch.setattr(classic_probe, "Canvas", lambda *_args: canvas)
    monkeypatch.setattr(
        classic_probe.getpass, "getpass", lambda _prompt="": "secret-token"
    )
    monkeypatch.setattr("builtins.input", lambda _prompt="": next(confirmations))
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "classic",
            "--base-url",
            "https://canvas.example.edu",
            "--course-id",
            "course-1",
            "--quiz-id",
            "quiz-1",
            "--confirm-test-course",
            "course-1",
            "--allow-write",
            "--pause-for-ui",
            "--report",
            str(report_path),
        ],
    )

    assert classic_probe.main() == 0
    report_text = report_path.read_text(encoding="utf-8")
    report = json.loads(report_text)
    assert report["ui_edit_verified"] is True
    assert report["ui_restore_verified"] is True
    assert report["restored"] is True
    assert quiz.payload == original
    assert "secret-token" not in report_text
