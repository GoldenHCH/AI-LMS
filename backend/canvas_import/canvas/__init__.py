"""Canvas-specific adapters; the model package intentionally imports none of these."""

from .adapter import CanvasAdapter, CanvasImportError, PartialImportError
from .new_quizzes import NewQuizClient
from .oauth import CanvasOAuthClient, OAuthToken

__all__ = [
    "CanvasAdapter",
    "CanvasImportError",
    "CanvasOAuthClient",
    "NewQuizClient",
    "OAuthToken",
    "PartialImportError",
]
