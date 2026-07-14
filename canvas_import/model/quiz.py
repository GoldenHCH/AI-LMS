"""Quiz, question, and answer types with lossless Canvas payload escape hatches."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

from ._serialization import CanvasId, JsonObject, json_copy, links_from_dict, optional_json_object

QuizEngine = Literal["classic", "new"]


@dataclass(slots=True)
class Answer:
    answer_id: CanvasId | None
    text_html: str
    weight: float | int | None
    is_correct: bool | None
    comments_html: str | None
    raw_payload: JsonObject = field(default_factory=dict, repr=False)

    def to_dict(self) -> JsonObject:
        return {
            "answer_id": self.answer_id,
            "text_html": self.text_html,
            "weight": self.weight,
            "is_correct": self.is_correct,
            "comments_html": self.comments_html,
            "raw_payload": json_copy(self.raw_payload),
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Answer:
        return cls(
            answer_id=data.get("answer_id"),
            text_html=data.get("text_html", ""),
            weight=data.get("weight"),
            is_correct=data.get("is_correct"),
            comments_html=data.get("comments_html"),
            raw_payload=optional_json_object(data.get("raw_payload")),
        )


@dataclass(slots=True)
class Question:
    question_id: CanvasId
    position: int
    question_type: str
    stem_html: str
    points_possible: float | int | None
    answers: list[Answer] = field(default_factory=list)
    type_specific: JsonObject = field(default_factory=dict)
    links: list[JsonObject] = field(default_factory=list)
    raw_payload: JsonObject = field(default_factory=dict, repr=False)
    read_only_reason: str | None = None

    def to_dict(self) -> JsonObject:
        return {
            "question_id": self.question_id,
            "position": self.position,
            "question_type": self.question_type,
            "stem_html": self.stem_html,
            "points_possible": self.points_possible,
            "answers": [answer.to_dict() for answer in self.answers],
            "type_specific": json_copy(self.type_specific),
            "links": json_copy(self.links),
            "raw_payload": json_copy(self.raw_payload),
            "read_only_reason": self.read_only_reason,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Question:
        return cls(
            question_id=data["question_id"],
            position=data.get("position", 0),
            question_type=data["question_type"],
            stem_html=data.get("stem_html", ""),
            points_possible=data.get("points_possible"),
            answers=[Answer.from_dict(answer) for answer in data.get("answers", [])],
            type_specific=optional_json_object(data.get("type_specific")),
            links=links_from_dict(data.get("links")),
            raw_payload=optional_json_object(data.get("raw_payload")),
            read_only_reason=data.get("read_only_reason"),
        )


@dataclass(slots=True)
class Quiz:
    quiz_id: CanvasId
    engine: QuizEngine
    title: str
    description_html: str
    points_possible: float | int | None
    question_count: int
    questions: list[Question] = field(default_factory=list)
    links: list[JsonObject] = field(default_factory=list)
    raw_payload: JsonObject = field(default_factory=dict, repr=False)
    read_only_reason: str | None = None

    def __post_init__(self) -> None:
        if self.engine not in ("classic", "new"):
            raise ValueError(f"Unsupported quiz engine: {self.engine}")
        if self.question_count != len(self.questions):
            raise ValueError("question_count must equal the number of imported questions")

    @property
    def editable(self) -> bool:
        return self.read_only_reason is None and all(
            question.read_only_reason is None for question in self.questions
        )

    def to_dict(self) -> JsonObject:
        return {
            "quiz_id": self.quiz_id,
            "engine": self.engine,
            "title": self.title,
            "description_html": self.description_html,
            "points_possible": self.points_possible,
            "question_count": self.question_count,
            "questions": [question.to_dict() for question in self.questions],
            "links": json_copy(self.links),
            "raw_payload": json_copy(self.raw_payload),
            "read_only_reason": self.read_only_reason,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Quiz:
        questions = [Question.from_dict(question) for question in data.get("questions", [])]
        return cls(
            quiz_id=data["quiz_id"],
            engine=data["engine"],
            title=data["title"],
            description_html=data.get("description_html", ""),
            points_possible=data.get("points_possible"),
            question_count=data.get("question_count", len(questions)),
            questions=questions,
            links=links_from_dict(data.get("links")),
            raw_payload=optional_json_object(data.get("raw_payload")),
            read_only_reason=data.get("read_only_reason"),
        )
