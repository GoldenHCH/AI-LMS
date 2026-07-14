"""Read-only file references."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from ._serialization import CanvasId, JsonObject, json_copy, links_from_dict, optional_json_object


@dataclass(slots=True)
class FileRef:
    """Metadata for a Canvas file; file bytes are deliberately not imported."""

    file_id: CanvasId
    display_name: str
    content_type: str | None
    url: str
    links: list[JsonObject] = field(default_factory=list)
    raw_payload: JsonObject = field(default_factory=dict, repr=False)

    def to_dict(self) -> JsonObject:
        return {
            "file_id": self.file_id,
            "display_name": self.display_name,
            "content_type": self.content_type,
            "url": self.url,
            "links": json_copy(self.links),
            "raw_payload": json_copy(self.raw_payload),
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> FileRef:
        return cls(
            file_id=data["file_id"],
            display_name=data["display_name"],
            content_type=data.get("content_type"),
            url=data.get("url", ""),
            links=links_from_dict(data.get("links")),
            raw_payload=optional_json_object(data.get("raw_payload")),
        )
