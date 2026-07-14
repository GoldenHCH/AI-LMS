"""Ordered course modules and discriminated module items."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

from ._serialization import CanvasId, JsonObject, json_copy, optional_json_object
from .file_ref import FileRef
from .page import Page
from .quiz import Quiz

ItemKind = Literal["page", "quiz", "file", "opaque"]


@dataclass(slots=True)
class ModuleItem:
    canvas_module_item_id: CanvasId
    position: int
    kind: ItemKind
    page: Page | None = None
    quiz: Quiz | None = None
    file: FileRef | None = None
    opaque: JsonObject | None = None
    raw_payload: JsonObject = field(default_factory=dict, repr=False)

    def __post_init__(self) -> None:
        if self.kind not in ("page", "quiz", "file", "opaque"):
            raise ValueError(f"Unsupported item kind: {self.kind}")
        content = {
            "page": self.page,
            "quiz": self.quiz,
            "file": self.file,
            "opaque": self.opaque,
        }
        if content[self.kind] is None:
            raise ValueError(f"{self.kind} item is missing its content")
        if any(value is not None for key, value in content.items() if key != self.kind):
            raise ValueError("A module item must contain exactly one content object")

    def to_dict(self) -> JsonObject:
        data: JsonObject = {
            "canvas_module_item_id": self.canvas_module_item_id,
            "position": self.position,
            "kind": self.kind,
            "raw_payload": json_copy(self.raw_payload),
        }
        if self.page is not None:
            data["page"] = self.page.to_dict()
        elif self.quiz is not None:
            data["quiz"] = self.quiz.to_dict()
        elif self.file is not None:
            data["file"] = self.file.to_dict()
        else:
            data["opaque"] = json_copy(self.opaque)
        return data

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ModuleItem:
        kind = data["kind"]
        return cls(
            canvas_module_item_id=data["canvas_module_item_id"],
            position=data.get("position", 0),
            kind=kind,
            page=Page.from_dict(data["page"]) if kind == "page" else None,
            quiz=Quiz.from_dict(data["quiz"]) if kind == "quiz" else None,
            file=FileRef.from_dict(data["file"]) if kind == "file" else None,
            opaque=optional_json_object(data.get("opaque")) if kind == "opaque" else None,
            raw_payload=optional_json_object(data.get("raw_payload")),
        )


@dataclass(slots=True)
class Module:
    canvas_module_id: CanvasId
    name: str
    position: int
    items: list[ModuleItem] = field(default_factory=list)
    raw_payload: JsonObject = field(default_factory=dict, repr=False)

    def to_dict(self) -> JsonObject:
        return {
            "canvas_module_id": self.canvas_module_id,
            "name": self.name,
            "position": self.position,
            "items": [item.to_dict() for item in self.items],
            "raw_payload": json_copy(self.raw_payload),
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Module:
        return cls(
            canvas_module_id=data["canvas_module_id"],
            name=data["name"],
            position=data.get("position", 0),
            items=[ModuleItem.from_dict(item) for item in data.get("items", [])],
            raw_payload=optional_json_object(data.get("raw_payload")),
        )
