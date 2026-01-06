"""
Log redaction utilities for task logs.
"""

from __future__ import annotations

import re
from re import Pattern

# Keep this list in sync with UI redaction rules:
# - auto-codex-ui/src/main/log-service.ts
# - auto-codex-ui/src/main/task-log-service.ts
# - auto-codex-ui/src/shared/utils/debug-logger.ts
REDACTION_RULES: list[tuple[Pattern[str], str]] = [
    (re.compile(r"(sk-[A-Za-z0-9_-]{10,})"), "[REDACTED]"),
    (re.compile(r"(sess-[A-Za-z0-9_-]{10,})"), "[REDACTED]"),
    (re.compile(r"(sk-ant-[A-Za-z0-9_-]{10,})"), "[REDACTED]"),
    (re.compile(r"(codex_oauth_[A-Za-z0-9._-]{10,})"), "[REDACTED]"),
    (re.compile(r"(ghp_[A-Za-z0-9]{10,})"), "[REDACTED]"),
    (re.compile(r"(gho_[A-Za-z0-9]{10,})"), "[REDACTED]"),
    (re.compile(r"(ghs_[A-Za-z0-9]{10,})"), "[REDACTED]"),
    (re.compile(r"(ghr_[A-Za-z0-9]{10,})"), "[REDACTED]"),
    (re.compile(r"(ghu_[A-Za-z0-9]{10,})"), "[REDACTED]"),
    (re.compile(r"(github_pat_[A-Za-z0-9_]{10,})"), "[REDACTED]"),
    (re.compile(r"(lin_api_[A-Za-z0-9]{10,})"), "[REDACTED]"),
    (re.compile(r"(AIza[0-9A-Za-z_-]{35})"), "[REDACTED]"),
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
