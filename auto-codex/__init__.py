"""
Auto Codex - Autonomous Coding Framework
========================================

Multi-agent autonomous coding framework that builds software through
coordinated AI agent sessions.

This project is a Codex-based fork derived from https://github.com/AndyMik90/Auto-Claude.
"""

import json
from pathlib import Path


def _get_version() -> str:
    """Get version from package.json (single source of truth)."""
    package_json = Path(__file__).parent.parent / "auto-codex-ui" / "package.json"
    try:
        with open(package_json, encoding="utf-8") as f:
            return json.load(f).get("version", "0.0.0")
    except (FileNotFoundError, json.JSONDecodeError, KeyError):
        return "0.0.0"


__version__ = _get_version()
