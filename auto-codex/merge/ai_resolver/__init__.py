"""
AI Resolver Module
==================

AI-based conflict resolution for the Auto Codex merge system.

This module provides intelligent conflict resolution using AI with
minimal context to reduce token usage and cost.

Components:
- AIResolver: Main resolver class
- ConflictContext: Minimal context for AI prompts
- create_llm_resolver: Factory for provider-backed resolver

Usage:
    from merge.ai_resolver import AIResolver, create_llm_resolver

    # Create resolver with provider-backed integration
    resolver = create_llm_resolver()

    # Or create with custom AI function
    resolver = AIResolver(ai_call_fn=my_ai_function)

    # Resolve a conflict
    result = resolver.resolve_conflict(conflict, baseline_code, task_snapshots)
"""

from .context import ConflictContext
from .llm_client import create_llm_resolver
from .resolver import AIResolver

__all__ = [
    "AIResolver",
    "ConflictContext",
    "create_llm_resolver",
]
