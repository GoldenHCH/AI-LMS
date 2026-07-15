"""Small helpers shared by the storage-agnostic model types."""

from __future__ import annotations

from copy import deepcopy
from typing import Any, TypeAlias

CanvasId: TypeAlias = int | str
JsonObject: TypeAlias = dict[str, Any]


def json_copy(value: Any) -> Any:
    """Return a defensive copy of JSON-compatible data."""

    return deepcopy(value)


def optional_json_object(value: Any) -> JsonObject:
    """Copy a serialized object while treating a missing value as empty."""

    if value is None:
        return {}
    if not isinstance(value, dict):
        raise TypeError(f"Expected an object, got {type(value).__name__}")
    return json_copy(value)


def links_from_dict(value: Any) -> list[JsonObject]:
    """Deserialize the reserved semantic-link extension point."""

    if value is None:
        return []
    if not isinstance(value, list) or any(not isinstance(link, dict) for link in value):
        raise TypeError("links must be a list of objects")
    return json_copy(value)
