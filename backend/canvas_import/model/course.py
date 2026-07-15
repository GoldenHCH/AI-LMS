"""Top-level course working-copy type."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from ._serialization import CanvasId, JsonObject, json_copy, optional_json_object
from .file_ref import FileRef
from .module import Module


@dataclass(slots=True)
class Course:
    canvas_course_id: CanvasId
    name: str
    modules: list[Module] = field(default_factory=list)
    files: list[FileRef] = field(default_factory=list)
    raw_payload: JsonObject = field(default_factory=dict, repr=False)

    def to_dict(self) -> JsonObject:
        return {
            "canvas_course_id": self.canvas_course_id,
            "name": self.name,
            "modules": [module.to_dict() for module in self.modules],
            "files": [file.to_dict() for file in self.files],
            "raw_payload": json_copy(self.raw_payload),
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Course:
        return cls(
            canvas_course_id=data["canvas_course_id"],
            name=data["name"],
            modules=[Module.from_dict(module) for module in data.get("modules", [])],
            files=[FileRef.from_dict(file) for file in data.get("files", [])],
            raw_payload=optional_json_object(data.get("raw_payload")),
        )
