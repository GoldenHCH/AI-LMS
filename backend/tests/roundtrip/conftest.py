from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any

import pytest


FIXTURES = Path(__file__).parents[1] / "fixtures"


class FakeHttpError(RuntimeError):
    def __init__(self, status_code: int) -> None:
        super().__init__(f"HTTP {status_code}")
        self.status_code = status_code


class FakeQuiz:
    def __init__(self, content: dict[str, Any], calls: list[tuple[str, str]]) -> None:
        self._quiz = deepcopy(content["quiz"])
        self._questions = deepcopy(content["questions"])
        self._calls = calls
        for key, value in self._quiz.items():
            setattr(self, key, value)

    def get_questions(self) -> list[dict[str, Any]]:
        self._calls.append(("GET", "classic_quiz_questions"))
        return deepcopy(self._questions)


class FakeModule:
    def __init__(self, data: dict[str, Any], calls: list[tuple[str, str]]) -> None:
        self._items = [deepcopy(item["module_item"]) for item in data["items"]]
        self._calls = calls
        for key, value in deepcopy(data["module"]).items():
            setattr(self, key, value)

    def get_module_items(self) -> list[dict[str, Any]]:
        self._calls.append(("GET", "module_items"))
        return deepcopy(self._items)


class FakeCourse:
    def __init__(self, fixture: dict[str, Any], calls: list[tuple[str, str]]) -> None:
        self._fixture = fixture
        self._calls = calls
        for key, value in deepcopy(fixture["course"]).items():
            setattr(self, key, value)

    def get_modules(self, **kwargs: Any) -> list[FakeModule]:
        assert kwargs == {"include": ["items"]}
        self._calls.append(("GET", "modules"))
        return [FakeModule(module, self._calls) for module in self._fixture["modules"]]

    def get_files(self) -> list[dict[str, Any]]:
        self._calls.append(("GET", "files"))
        return deepcopy(self._fixture["files"])

    def get_page(self, page_url: str) -> dict[str, Any]:
        self._calls.append(("GET", f"page:{page_url}"))
        for module in self._fixture["modules"]:
            for item in module["items"]:
                content = item["content"]
                if content["kind"] == "page" and content["page"]["url"] == page_url:
                    return deepcopy(content["page"])
        raise FakeHttpError(404)

    def get_quiz(self, quiz_id: int | str) -> FakeQuiz:
        self._calls.append(("GET", f"classic_quiz:{quiz_id}"))
        for module in self._fixture["modules"]:
            for item in module["items"]:
                content = item["content"]
                if (
                    content["kind"] == "quiz"
                    and content["engine"] == "classic"
                    and str(content["quiz"]["id"]) == str(quiz_id)
                ):
                    return FakeQuiz(content, self._calls)
        raise FakeHttpError(404)


class FakeCanvas:
    def __init__(self, fixture: dict[str, Any]) -> None:
        self.fixture = fixture
        self.calls: list[tuple[str, str]] = []

    def get_course(self, course_id: int | str) -> FakeCourse:
        self.calls.append(("GET", f"course:{course_id}"))
        if str(course_id) != str(self.fixture["course"]["id"]):
            raise FakeHttpError(404)
        return FakeCourse(self.fixture, self.calls)

    def get_courses(self) -> list[dict[str, Any]]:
        self.calls.append(("GET", "courses"))
        return [deepcopy(self.fixture["course"])]


class FakeNewQuizClient:
    def __init__(self, fixture: dict[str, Any], calls: list[tuple[str, str]]) -> None:
        self.fixture = fixture
        self.calls = calls

    def _content(self, assignment_id: int | str) -> dict[str, Any]:
        for module in self.fixture["modules"]:
            for item in module["items"]:
                content = item["content"]
                if (
                    content["kind"] == "quiz"
                    and content["engine"] == "new"
                    and str(item["module_item"]["content_id"]) == str(assignment_id)
                ):
                    return content
        raise FakeHttpError(404)

    def get_quiz(
        self, course_id: int | str, assignment_id: int | str
    ) -> dict[str, Any]:
        self.calls.append(("GET", f"new_quiz:{course_id}:{assignment_id}"))
        return deepcopy(self._content(assignment_id)["quiz"])

    def list_items(
        self, course_id: int | str, assignment_id: int | str
    ) -> list[dict[str, Any]]:
        self.calls.append(("GET", f"new_quiz_items:{course_id}:{assignment_id}"))
        return deepcopy(self._content(assignment_id)["questions"])


@pytest.fixture(params=["course_classic.json", "course_new_quiz.json"])
def canvas_fixture(request: pytest.FixtureRequest) -> dict[str, Any]:
    return json.loads((FIXTURES / request.param).read_text(encoding="utf-8"))
