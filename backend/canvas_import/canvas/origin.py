"""Validation for the only Canvas origins the import service may contact."""

from __future__ import annotations

import ipaddress
import os
from urllib.parse import urlsplit


class CanvasOriginError(ValueError):
    """The supplied Canvas origin is malformed or not on the allowlist."""


def validate_canvas_origin(
    value: str,
    *,
    configured_hosts: str | None = None,
) -> str:
    """Return a normalized HTTPS origin or fail before any network request."""

    if not isinstance(value, str) or not value or len(value) > 255:
        raise CanvasOriginError("Canvas URL must be a valid HTTPS origin")
    if value != value.strip():
        raise CanvasOriginError("Canvas URL must not contain surrounding whitespace")

    try:
        parsed = urlsplit(value)
        port = parsed.port
        hostname = parsed.hostname
    except ValueError as exc:
        raise CanvasOriginError("Canvas URL must be a valid HTTPS origin") from exc

    if parsed.scheme.lower() != "https" or not hostname:
        raise CanvasOriginError("Canvas URL must be a valid HTTPS origin")
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise CanvasOriginError(
            "Canvas URL must not include credentials, a query, or a fragment"
        )
    if parsed.path not in ("", "/"):
        raise CanvasOriginError("Canvas URL must contain only the instance origin")
    if port not in (None, 443):
        raise CanvasOriginError("Canvas URL must use the default HTTPS port")

    host = hostname.rstrip(".").lower()
    if host == "localhost" or host.endswith(".localhost"):
        raise CanvasOriginError("Local Canvas hosts are not supported")
    try:
        ipaddress.ip_address(host)
    except ValueError:
        pass
    else:
        raise CanvasOriginError("IP address Canvas hosts are not supported")

    allowed = _configured_hosts(configured_hosts)
    hosted_canvas = host.endswith(".instructure.com") and host != "instructure.com"
    if not hosted_canvas and host not in allowed:
        raise CanvasOriginError("This Canvas host is not supported")

    return f"https://{host}"


def _configured_hosts(value: str | None) -> set[str]:
    raw = os.getenv("CANVAS_ALLOWED_HOSTS", "") if value is None else value
    hosts: set[str] = set()
    for entry in raw.split(","):
        host = entry.strip().rstrip(".").lower()
        if not host:
            continue
        if "://" in host or "/" in host or ":" in host:
            raise CanvasOriginError(
                "CANVAS_ALLOWED_HOSTS must contain comma-separated hostnames"
            )
        try:
            ipaddress.ip_address(host)
        except ValueError:
            hosts.add(host)
        else:
            raise CanvasOriginError("CANVAS_ALLOWED_HOSTS cannot contain IP addresses")
    return hosts
