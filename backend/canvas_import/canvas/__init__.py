"""Canvas-specific adapters; the model package intentionally imports none of these."""

from .adapter import (
    CanvasAdapter,
    CanvasAuthenticationError,
    CanvasImportError,
    CanvasRateLimitError,
    CanvasTimeoutError,
    CanvasUnreachableError,
    PartialImportError,
)
from .new_quizzes import NewQuizClient
from .oauth import CanvasOAuthClient, OAuthToken
from .origin import CanvasOriginError, validate_canvas_origin

__all__ = [
    "CanvasAdapter",
    "CanvasAuthenticationError",
    "CanvasImportError",
    "CanvasOriginError",
    "CanvasOAuthClient",
    "CanvasRateLimitError",
    "CanvasTimeoutError",
    "CanvasUnreachableError",
    "NewQuizClient",
    "OAuthToken",
    "PartialImportError",
    "validate_canvas_origin",
]
