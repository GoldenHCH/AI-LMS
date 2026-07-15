#!/usr/bin/env python3
"""Seed the Supabase course scratchpad with both lossless Canvas fixtures."""

from __future__ import annotations

import os
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from canvas_import.fixture_loader import load_fixture_course
from canvas_import.persistence import SupabaseCourseWriter


FIXTURES = BACKEND_ROOT / "tests" / "fixtures"
DEFAULT_FIXTURES = ("course_classic.json", "course_new_quiz.json")


def _load_local_env(path: Path) -> None:
    """Load the explicit server-only settings without adding another dependency."""

    if not path.exists():
        return
    wanted = {
        "NEXT_PUBLIC_SUPABASE_URL",
        "SUPABASE_SECRET_KEY",
        "SUPABASE_SEED_CANVAS_BASE_URL",
    }
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        name = name.strip()
        if name not in wanted or name in os.environ:
            continue
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        os.environ[name] = value


def main() -> int:
    _load_local_env(REPO_ROOT / ".env")
    writer = SupabaseCourseWriter()
    canvas_base_url = os.getenv("SUPABASE_SEED_CANVAS_BASE_URL")
    if not canvas_base_url:
        raise RuntimeError("SUPABASE_SEED_CANVAS_BASE_URL is required")

    for fixture_name in DEFAULT_FIXTURES:
        course = load_fixture_course(FIXTURES / fixture_name)
        course_id = writer.write(
            course,
            canvas_base_url=canvas_base_url,
        )
        module_count = len(course.modules)
        item_count = sum(len(module.items) for module in course.modules)
        print(
            f"Seeded {course.name!r} as {course_id} "
            f"({module_count} module, {item_count} items)"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
