"""Persistence adapters for imported course working copies."""

from .supabase_writer import SupabaseCourseWriter

__all__ = ["SupabaseCourseWriter"]
