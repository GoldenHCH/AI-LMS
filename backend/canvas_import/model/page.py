"""Editable rich-text course pages."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from ._serialization import (
    CanvasId,
    JsonObject,
    json_copy,
    links_from_dict,
    optional_json_object,
)


@dataclass(slots=True)
class Page:
    """A page whose raw HTML is always the source of truth."""

    page_url: str
    page_id: CanvasId | None
    title: str
    body_html: str
    published: bool | None
    front_page: bool | None
    links: list[JsonObject] = field(default_factory=list)
    raw_payload: JsonObject = field(default_factory=dict, repr=False)

    def to_dict(self) -> JsonObject:
        return {
            "page_url": self.page_url,
            "page_id": self.page_id,
            "title": self.title,
            "body_html": self.body_html,
            "published": self.published,
            "front_page": self.front_page,
            "links": json_copy(self.links),
            "raw_payload": json_copy(self.raw_payload),
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Page:
        return cls(
            page_url=data["page_url"],
            page_id=data.get("page_id"),
            title=data["title"],
            body_html=data.get("body_html", ""),
            published=data.get("published"),
            front_page=data.get("front_page"),
            links=links_from_dict(data.get("links")),
            raw_payload=optional_json_object(data.get("raw_payload")),
        )
