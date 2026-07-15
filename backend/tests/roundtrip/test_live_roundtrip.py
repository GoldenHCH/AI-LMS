from __future__ import annotations

import os

import pytest

from canvas_import.canvas.adapter import CanvasAdapter
from canvas_import.canvas.new_quizzes import NewQuizClient
from canvas_import.store import WorkingCopyStore


@pytest.mark.live
def test_two_real_courses_survive_import_store_and_dry_run(tmp_path):
    base_url = os.getenv("CANVAS_BASE_URL")
    access_token = os.getenv("CANVAS_ACCESS_TOKEN")
    course_ids = [
        value.strip()
        for value in os.getenv("CANVAS_ROUNDTRIP_COURSE_IDS", "").split(",")
        if value.strip()
    ]
    if not base_url or not access_token or len(course_ids) < 2:
        pytest.skip("requires Canvas credentials and at least two real test-course IDs")
    canvasapi = pytest.importorskip("canvasapi")
    canvas = canvasapi.Canvas(base_url, access_token)
    adapter = CanvasAdapter(
        canvas,
        new_quiz_client=NewQuizClient(base_url, access_token),
    )

    for course_id in course_ids[:2]:
        imported = adapter.import_course(course_id)
        before = adapter.export_dry_run(imported)
        path = tmp_path / f"{course_id}.json"
        WorkingCopyStore().save(imported, path)
        restored = WorkingCopyStore().load(path)

        assert adapter.export_dry_run(restored) == before
