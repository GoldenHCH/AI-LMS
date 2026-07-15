from __future__ import annotations

import json
from copy import deepcopy
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Iterable


QUESTION_FIELDS = (
    "question_name",
    "question_text",
    "quiz_group_id",
    "question_type",
    "position",
    "points_possible",
    "correct_comments",
    "incorrect_comments",
    "neutral_comments",
    "text_after_answers",
)

ANSWER_PASSTHROUGH_FIELDS = (
    "text_after_answers",
    "answer_match_left",
    "answer_match_right",
    "matching_answer_incorrect_matches",
    "numerical_answer_type",
    "exact",
    "margin",
    "approximate",
    "precision",
    "start",
    "end",
    "blank_id",
)

NEW_ENTRY_FIELDS = (
    "title",
    "item_body",
    "calculator_type",
    "feedback",
    "interaction_type_slug",
    "interaction_data",
    "properties",
    "scoring_data",
    "answer_feedback",
    "scoring_algorithm",
)


def public_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return deepcopy(value)
    return {
        key: deepcopy(item)
        for key, item in vars(value).items()
        if not key.startswith("_") and not callable(item)
    }


def classic_question_payload(raw: dict[str, Any]) -> dict[str, Any]:
    payload = {key: deepcopy(raw[key]) for key in QUESTION_FIELDS if key in raw}
    payload["answers"] = [
        classic_answer_payload(answer) for answer in raw.get("answers") or []
    ]
    return payload


def classic_answer_payload(raw_value: Any) -> dict[str, Any]:
    raw = public_dict(raw_value)
    payload = {
        key: deepcopy(raw[key]) for key in ANSWER_PASSTHROUGH_FIELDS if key in raw
    }
    if raw.get("id") is not None:
        payload["id"] = raw["id"]
    payload["answer_text"] = first(raw, "answer_text", "html", "text", default="")
    payload["answer_weight"] = first(raw, "answer_weight", "weight", default=0)
    comments = first(
        raw,
        "answer_comments",
        "comments_html",
        "comments",
        default=None,
    )
    if comments is not None:
        payload["answer_comments"] = comments
    return payload


def new_item_payload(raw: dict[str, Any]) -> dict[str, Any]:
    payload = {
        key: deepcopy(raw[key])
        for key in ("position", "points_possible", "entry_type", "properties")
        if key in raw
    }
    entry = raw.get("entry")
    if isinstance(entry, dict):
        payload["entry"] = {
            key: deepcopy(entry[key]) for key in NEW_ENTRY_FIELDS if key in entry
        }
    return payload


def first(data: dict[str, Any], *keys: str, default: Any = None) -> Any:
    for key in keys:
        if key in data and data[key] is not None:
            return data[key]
    return default


def diff_paths(expected: Any, actual: Any, path: str = "$") -> list[str]:
    if type(expected) is not type(actual):
        return [path]
    if isinstance(expected, dict):
        paths: list[str] = []
        for key in sorted(set(expected) | set(actual)):
            if key not in expected or key not in actual:
                paths.append(f"{path}.{key}")
            else:
                paths.extend(diff_paths(expected[key], actual[key], f"{path}.{key}"))
        return paths
    if isinstance(expected, list):
        paths = []
        if len(expected) != len(actual):
            paths.append(f"{path}.length")
        for index, (left, right) in enumerate(zip(expected, actual)):
            paths.extend(diff_paths(left, right, f"{path}[{index}]"))
        return paths
    return [] if expected == actual else [path]


def base_report(engine: str, course_id: str, quiz_id: str) -> dict[str, Any]:
    return {
        "engine": engine,
        "course_id": course_id,
        "quiz_id": quiz_id,
        "run_at": datetime.now(UTC).isoformat(),
        "contains_access_token": False,
    }


def emit_report(report: dict[str, Any], report_path: str | None) -> None:
    serialized = json.dumps(report, indent=2, ensure_ascii=False, sort_keys=True)
    print(serialized)
    if report_path:
        path = Path(report_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(f"{serialized}\n", encoding="utf-8")


def require_write_confirmation(
    *, allow_write: bool, course_id: str, confirmed_course_id: str
) -> None:
    if not allow_write:
        raise SystemExit(
            "Refusing to write: pass --allow-write for an isolated Canvas test course"
        )
    if course_id != confirmed_course_id:
        raise SystemExit(
            "Refusing to write: --confirm-test-course must exactly match --course-id"
        )


def choose_by_id(values: Iterable[Any], requested_id: str | None) -> Any:
    values = list(values)
    if requested_id is None:
        if not values:
            raise SystemExit("No suitable quiz question/item was found")
        return values[0]
    for value in values:
        raw = public_dict(value)
        if str(raw.get("id")) == requested_id:
            return value
    raise SystemExit(
        f"Requested question/item {requested_id} was not found or is not editable"
    )
