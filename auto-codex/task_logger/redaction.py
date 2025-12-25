"""
Log redaction utilities for task logs.
"""

from __future__ import annotations

import re
from typing import Pattern

REDACTION_RULES: list[tuple[Pattern[str], str]] = [
    (re.compile(r"(sk-[A-Za-z0-9_-]{10,})"), "[REDACTED]"),
    (re.compile(r"(codex_oauth_[A-Za-z0-9._-]{10,})"), "[REDACTED]"),
    (re.compile(r"(ghp_[A-Za-z0-9]{10,})"), "[REDACTED]"),
    (re.compile(r"(gho_[A-Za-z0-9]{10,})"), "[REDACTED]"),
    (re.compile(r"(ya29\.[A-Za-z0-9._-]{10,})"), "[REDACTED]"),
    (re.compile(r"(Bearer\s+)(\S+)", flags=re.IGNORECASE), r"\1[REDACTED]"),
    (
        re.compile(r"((?:api[_-]?key|token|secret|password)\s*[:=]\s*)([^\s]+)", flags=re.IGNORECASE),
        r"\1[REDACTED]",
    ),
]


def redact_text(value: str) -> str:
    """Redact common secret patterns from a string."""
    redacted = value
    for pattern, replacement in REDACTION_RULES:
        redacted = pattern.sub(replacement, redacted)
    return redacted
