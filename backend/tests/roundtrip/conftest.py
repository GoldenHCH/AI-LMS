from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from canvas_import.fixture_loader import FakeCanvas, FakeNewQuizClient


FIXTURES = Path(__file__).parents[1] / "fixtures"


@pytest.fixture(params=["course_classic.json", "course_new_quiz.json"])
def canvas_fixture(request: pytest.FixtureRequest) -> dict[str, Any]:
    return json.loads((FIXTURES / request.param).read_text(encoding="utf-8"))
