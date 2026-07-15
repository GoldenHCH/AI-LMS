"""Live New Quiz fidelity probe for an ordinary choice QuestionItem."""

from __future__ import annotations

import argparse
import os
from copy import deepcopy
from typing import Any

from canvas_import.canvas.new_quizzes import NewQuizClient

from .common import (
    base_report,
    choose_by_id,
    diff_paths,
    emit_report,
    new_item_payload,
    require_write_confirmation,
)

MARKER = " [cursor-canvas-writeback-spike]"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--base-url", default=os.getenv("CANVAS_BASE_URL"), required=False
    )
    parser.add_argument(
        "--access-token", default=os.getenv("CANVAS_ACCESS_TOKEN"), required=False
    )
    parser.add_argument("--course-id", required=True)
    parser.add_argument(
        "--assignment-id",
        required=True,
        help="Assignment ID associated with the New Quiz",
    )
    parser.add_argument("--item-id")
    parser.add_argument("--confirm-test-course", required=True)
    parser.add_argument("--allow-write", action="store_true")
    parser.add_argument("--allow-published", action="store_true")
    parser.add_argument("--leave-edited", action="store_true")
    parser.add_argument("--report")
    args = parser.parse_args()
    if not args.base_url or not args.access_token:
        parser.error("set CANVAS_BASE_URL/CANVAS_ACCESS_TOKEN or pass both options")
    return args


def main() -> int:
    args = parse_args()
    require_write_confirmation(
        allow_write=args.allow_write,
        course_id=args.course_id,
        confirmed_course_id=args.confirm_test_course,
    )
    client = NewQuizClient(args.base_url, args.access_token)
    quiz = client.get_quiz(args.course_id, args.assignment_id)
    if quiz.get("published") and not args.allow_published:
        raise SystemExit(
            "Refusing to touch a published quiz; use an unpublished test quiz"
        )
    items = client.list_items(args.course_id, args.assignment_id)
    candidates = [item for item in items if _is_editable_choice(item)]
    item = choose_by_id(candidates, args.item_id)
    item_id = str(item["id"])
    original = new_item_payload(item)
    report = base_report("new", args.course_id, args.assignment_id)
    report["item_id"] = item_id
    report["get_only_item_counts"] = {
        kind: sum(1 for value in items if value.get("entry_type") == kind)
        for kind in ("Stimulus", "BankEntry", "Bank")
    }
    restored = False

    try:
        client.update_item(
            args.course_id, args.assignment_id, item_id, deepcopy(original)
        )
        unchanged = new_item_payload(
            client.get_item(args.course_id, args.assignment_id, item_id)
        )
        report["unchanged_round_trip_diff_paths"] = diff_paths(original, unchanged)

        mutated = _mutated_payload(original)
        client.update_item(
            args.course_id, args.assignment_id, item_id, deepcopy(mutated)
        )
        edited = new_item_payload(
            client.get_item(args.course_id, args.assignment_id, item_id)
        )
        report["edit_diff_paths"] = diff_paths(mutated, edited)
        report["stem_verified"] = edited["entry"].get("item_body") == mutated[
            "entry"
        ].get("item_body")
        report["option_verified"] = edited["entry"]["interaction_data"]["choices"][
            0
        ].get("itemBody") == mutated["entry"]["interaction_data"]["choices"][0].get(
            "itemBody"
        )
        report["correct_answer_verified"] = edited["entry"].get(
            "scoring_data"
        ) == mutated["entry"].get("scoring_data")
        report["points_verified"] = edited.get("points_possible") == mutated.get(
            "points_possible"
        )
    finally:
        if not args.leave_edited:
            client.update_item(
                args.course_id, args.assignment_id, item_id, deepcopy(original)
            )
            restored_payload = new_item_payload(
                client.get_item(args.course_id, args.assignment_id, item_id)
            )
            restored = not diff_paths(original, restored_payload)
        report["restored"] = restored
        report["left_edited_for_ui_verification"] = bool(args.leave_edited)
        emit_report(report, args.report)

    passed = (
        not report["unchanged_round_trip_diff_paths"] and not report["edit_diff_paths"]
    )
    passed = passed and all(
        report[key]
        for key in (
            "stem_verified",
            "option_verified",
            "correct_answer_verified",
            "points_verified",
        )
    )
    return 0 if passed else 1


def _is_editable_choice(item: dict[str, Any]) -> bool:
    if item.get("entry_type") != "Item" or not isinstance(item.get("entry"), dict):
        return False
    entry = item["entry"]
    interaction = entry.get("interaction_data")
    return (
        entry.get("interaction_type_slug") == "choice"
        and isinstance(interaction, dict)
        and isinstance(interaction.get("choices"), list)
        and len(interaction["choices"]) >= 2
    )


def _mutated_payload(original: dict[str, Any]) -> dict[str, Any]:
    payload = deepcopy(original)
    entry = payload["entry"]
    entry["item_body"] = f"{entry.get('item_body', '')}{MARKER}"
    choices = entry["interaction_data"]["choices"]
    choices[0]["itemBody"] = f"{choices[0].get('itemBody', '')}{MARKER}"
    current = str(entry.get("scoring_data", {}).get("value"))
    replacement = next(choice for choice in choices if str(choice.get("id")) != current)
    entry.setdefault("scoring_data", {})["value"] = replacement["id"]
    points = payload.get("points_possible")
    payload["points_possible"] = (points if isinstance(points, (int, float)) else 0) + 1
    return payload


if __name__ == "__main__":
    raise SystemExit(main())
