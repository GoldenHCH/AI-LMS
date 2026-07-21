"""Live Classic Quiz fidelity probe.

Run only against an isolated, unpublished test quiz. The script restores the original
question by default, including after a failed assertion.
"""

from __future__ import annotations

import argparse
import getpass
from copy import deepcopy
from typing import Any

from canvasapi import Canvas

from .common import (
    base_report,
    choose_by_id,
    classic_question_payload,
    diff_paths,
    emit_report,
    public_dict,
    require_write_confirmation,
)

MARKER = " [cursor-canvas-writeback-spike]"
EDIT_UI_CONFIRMATION = "EDIT_VERIFIED"
RESTORE_UI_CONFIRMATION = "RESTORE_VERIFIED"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url")
    parser.add_argument("--course-id", required=True)
    parser.add_argument("--quiz-id", required=True)
    parser.add_argument("--question-id")
    parser.add_argument("--confirm-test-course", required=True)
    parser.add_argument("--allow-write", action="store_true")
    parser.add_argument("--allow-published", action="store_true")
    edit_lifecycle = parser.add_mutually_exclusive_group()
    edit_lifecycle.add_argument("--leave-edited", action="store_true")
    edit_lifecycle.add_argument(
        "--pause-for-ui",
        action="store_true",
        help="pause after the temporary edit and again after automatic restoration",
    )
    parser.add_argument("--report")
    args = parser.parse_args()
    if not args.base_url:
        args.base_url = input("Canvas HTTPS origin: ").strip()
    args.access_token = getpass.getpass("Canvas personal access token: ")
    if not args.base_url or not args.access_token:
        parser.error("a Canvas URL and access token are required")
    return args


def main() -> int:
    args = parse_args()
    require_write_confirmation(
        allow_write=args.allow_write,
        course_id=args.course_id,
        confirmed_course_id=args.confirm_test_course,
    )
    canvas = Canvas(args.base_url, args.access_token)
    course = canvas.get_course(args.course_id)
    quiz = course.get_quiz(args.quiz_id)
    if getattr(quiz, "published", False) and not args.allow_published:
        raise SystemExit(
            "Refusing to touch a published quiz; use an unpublished test quiz"
        )
    candidates = [
        question
        for question in quiz.get_questions()
        if len(public_dict(question).get("answers") or []) >= 2
    ]
    question = choose_by_id(candidates, args.question_id)
    question_id = str(public_dict(question)["id"])
    original = classic_question_payload(public_dict(question))
    report = base_report("classic", args.course_id, args.quiz_id)
    report["question_id"] = question_id
    report["quiz_was_published"] = bool(getattr(quiz, "published", False))
    report["published_quiz_override_used"] = bool(
        report["quiz_was_published"] and args.allow_published
    )
    report["paused_for_ui_verification"] = bool(args.pause_for_ui)
    report["ui_edit_verified"] = False
    report["ui_restore_verified"] = False
    restored = False

    try:
        question.edit(question=deepcopy(original))
        unchanged_raw = public_dict(quiz.get_question(question_id))
        unchanged = classic_question_payload(unchanged_raw)
        report["unchanged_round_trip_diff_paths"] = diff_paths(original, unchanged)

        mutated = _mutated_payload(original)
        question.edit(question=deepcopy(mutated))
        edited_raw = public_dict(quiz.get_question(question_id))
        edited = classic_question_payload(edited_raw)
        report["edit_diff_paths"] = diff_paths(mutated, edited)
        report["stem_verified"] = edited.get("question_text") == mutated.get(
            "question_text"
        )
        report["option_verified"] = edited["answers"][0].get("answer_text") == mutated[
            "answers"
        ][0].get("answer_text")
        report["correct_answer_verified"] = _correct_ids(edited) == _correct_ids(
            mutated
        )
        report["points_verified"] = edited.get("points_possible") == mutated.get(
            "points_possible"
        )
        if args.pause_for_ui:
            report["ui_edit_verified"] = _confirm_ui(
                "Refresh the Canvas quiz and verify the temporary stem, option, "
                "correct-answer, and point edits.",
                EDIT_UI_CONFIRMATION,
            )
    finally:
        if not args.leave_edited:
            question.edit(question=deepcopy(original))
            restored_payload = classic_question_payload(
                public_dict(quiz.get_question(question_id))
            )
            restored = not diff_paths(original, restored_payload)
        report["restored"] = restored
        report["left_edited_for_ui_verification"] = bool(args.leave_edited)
        if args.pause_for_ui and restored:
            report["ui_restore_verified"] = _confirm_ui(
                "Refresh the Canvas quiz and verify the original question was restored.",
                RESTORE_UI_CONFIRMATION,
            )
        emit_report(report, args.report)

    passed = (
        not report["unchanged_round_trip_diff_paths"] and not report["edit_diff_paths"]
    )
    passed = (
        passed
        and report["restored"]
        and all(
            report[key]
            for key in (
                "stem_verified",
                "option_verified",
                "correct_answer_verified",
                "points_verified",
            )
        )
    )
    if args.pause_for_ui:
        passed = passed and all(
            report[key] for key in ("ui_edit_verified", "ui_restore_verified")
        )
    return 0 if passed else 1


def _confirm_ui(instruction: str, confirmation: str) -> bool:
    try:
        response = input(f"{instruction} Type {confirmation} to continue: ")
    except EOFError:
        return False
    return response.strip() == confirmation


def _mutated_payload(original: dict[str, Any]) -> dict[str, Any]:
    payload = deepcopy(original)
    payload["question_text"] = f"{payload.get('question_text', '')}{MARKER}"
    payload["answers"][0][
        "answer_text"
    ] = f"{payload['answers'][0].get('answer_text', '')}{MARKER}"
    current_correct = next(
        (
            index
            for index, answer in enumerate(payload["answers"])
            if answer.get("answer_weight") == 100
        ),
        0,
    )
    replacement = next(
        index for index in range(len(payload["answers"])) if index != current_correct
    )
    payload["answers"][current_correct]["answer_weight"] = 0
    payload["answers"][replacement]["answer_weight"] = 100
    points = payload.get("points_possible")
    payload["points_possible"] = (points if isinstance(points, (int, float)) else 0) + 1
    return payload


def _correct_ids(payload: dict[str, Any]) -> set[str]:
    return {
        str(answer.get("id", index))
        for index, answer in enumerate(payload.get("answers", []))
        if answer.get("answer_weight") == 100
    }


if __name__ == "__main__":
    raise SystemExit(main())
