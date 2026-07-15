"""Versioned JSON persistence for an editable course working copy."""

from __future__ import annotations

import json
import os
import tempfile
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from .model import Course

SCHEMA_VERSION = 1
DEFAULT_RETENTION_DAYS = 90


class WorkingCopyError(RuntimeError):
    """Base error for working-copy persistence failures."""


class UnsupportedSchemaVersion(WorkingCopyError):
    """Raised when a working copy was written by an unsupported schema."""


@dataclass(frozen=True, slots=True)
class WorkingCopyMetadata:
    created_at: datetime
    delete_after: datetime
    schema_version: int = SCHEMA_VERSION


class WorkingCopyStore:
    """Persist course documents atomically, privately, and with bounded retention."""

    def __init__(self, retention_days: int = DEFAULT_RETENTION_DAYS) -> None:
        if retention_days <= 0:
            raise ValueError("retention_days must be positive")
        self.retention_days = retention_days

    def save(self, course: Course, path: str | Path) -> WorkingCopyMetadata:
        destination = Path(path)
        destination.parent.mkdir(parents=True, exist_ok=True)
        now = datetime.now(UTC)
        metadata = WorkingCopyMetadata(
            created_at=now,
            delete_after=now + timedelta(days=self.retention_days),
        )
        envelope = {
            "schema_version": metadata.schema_version,
            "created_at": metadata.created_at.isoformat(),
            "delete_after": metadata.delete_after.isoformat(),
            "course": course.to_dict(),
        }

        temporary_path: Path | None = None
        try:
            with tempfile.NamedTemporaryFile(
                mode="w",
                encoding="utf-8",
                dir=destination.parent,
                prefix=f".{destination.name}.",
                suffix=".tmp",
                delete=False,
            ) as handle:
                temporary_path = Path(handle.name)
                os.chmod(temporary_path, 0o600)
                json.dump(envelope, handle, ensure_ascii=False, separators=(",", ":"))
                handle.flush()
                os.fsync(handle.fileno())
            temporary_path.replace(destination)
            os.chmod(destination, 0o600)
        except (OSError, TypeError, ValueError) as exc:
            if temporary_path is not None:
                temporary_path.unlink(missing_ok=True)
            raise WorkingCopyError(f"Could not save working copy: {exc}") from exc
        return metadata

    def load(self, path: str | Path, *, allow_expired: bool = False) -> Course:
        envelope = self._read_envelope(path)
        version = envelope.get("schema_version")
        if version != SCHEMA_VERSION:
            raise UnsupportedSchemaVersion(
                f"Working copy schema {version!r} is unsupported; expected {SCHEMA_VERSION}"
            )
        if not allow_expired and self._delete_after(envelope) <= datetime.now(UTC):
            raise WorkingCopyError("Working copy has passed its retention deadline")
        course_data = envelope.get("course")
        if not isinstance(course_data, dict):
            raise WorkingCopyError("Working copy is missing its course document")
        try:
            return Course.from_dict(course_data)
        except (KeyError, TypeError, ValueError) as exc:
            raise WorkingCopyError(f"Working copy is invalid: {exc}") from exc

    def metadata(self, path: str | Path) -> WorkingCopyMetadata:
        envelope = self._read_envelope(path)
        try:
            return WorkingCopyMetadata(
                created_at=datetime.fromisoformat(envelope["created_at"]),
                delete_after=self._delete_after(envelope),
                schema_version=int(envelope["schema_version"]),
            )
        except (KeyError, TypeError, ValueError) as exc:
            raise WorkingCopyError(f"Working-copy metadata is invalid: {exc}") from exc

    def is_expired(self, path: str | Path, *, now: datetime | None = None) -> bool:
        envelope = self._read_envelope(path)
        return self._delete_after(envelope) <= (now or datetime.now(UTC))

    @staticmethod
    def _read_envelope(path: str | Path) -> dict[str, Any]:
        try:
            with Path(path).open(encoding="utf-8") as handle:
                data = json.load(handle)
        except (OSError, json.JSONDecodeError) as exc:
            raise WorkingCopyError(f"Could not load working copy: {exc}") from exc
        if not isinstance(data, dict):
            raise WorkingCopyError("Working copy root must be an object")
        return data

    @staticmethod
    def _delete_after(envelope: dict[str, Any]) -> datetime:
        try:
            delete_after = datetime.fromisoformat(envelope["delete_after"])
        except (KeyError, TypeError, ValueError) as exc:
            raise WorkingCopyError(
                f"Working copy has no valid retention deadline: {exc}"
            ) from exc
        if delete_after.tzinfo is None:
            raise WorkingCopyError(
                "Working-copy retention deadline must include a timezone"
            )
        return delete_after
