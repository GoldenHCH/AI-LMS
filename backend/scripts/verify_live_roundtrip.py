#!/usr/bin/env python3
"""Interactively verify two isolated Canvas courses without storing credentials."""

from __future__ import annotations

import getpass
import sys
from pathlib import Path
from tempfile import TemporaryDirectory

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from canvas_import.canvas.adapter import CanvasAdapter
from canvas_import.canvas.new_quizzes import NewQuizClient
from canvas_import.store import WorkingCopyStore


def main() -> int:
    base_url = input("Canvas HTTPS origin: ").strip()
    access_token = getpass.getpass("Canvas personal access token: ")
    course_ids = [
        value.strip()
        for value in input("Two isolated test course IDs (comma-separated): ").split(",")
        if value.strip()
    ]
    if not base_url or not access_token or len(course_ids) < 2:
        raise SystemExit("A Canvas URL, token, and two course IDs are required")

    try:
        from canvasapi import Canvas

        adapter = CanvasAdapter(
            Canvas(base_url, access_token),
            new_quiz_client=NewQuizClient(base_url, access_token),
        )
        with TemporaryDirectory(prefix="canvas-roundtrip-") as directory:
            store = WorkingCopyStore()
            for course_id in course_ids[:2]:
                imported = adapter.import_course(course_id)
                before = adapter.export_dry_run(imported)
                path = Path(directory) / f"{course_id}.json"
                store.save(imported, path)
                restored = store.load(path)
                if adapter.export_dry_run(restored) != before:
                    raise RuntimeError(
                        f"Canvas course {course_id} failed the lossless round-trip gate"
                    )
    finally:
        access_token = ""

    print("Two-course live round-trip verification passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
