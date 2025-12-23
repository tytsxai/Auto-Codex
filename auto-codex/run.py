#!/usr/bin/env python3
"""
Auto Codex Framework
====================

A multi-session autonomous coding framework for building features and applications.
Uses subtask-based implementation plans with phase dependencies.

Key Features:
- Safe workspace isolation (builds in separate workspace by default)
- Parallel execution with Git worktrees
- Smart recovery from interruptions
- Linear integration for project management

Usage:
    python3 auto-codex/run.py --spec 001-initial-app
    python3 auto-codex/run.py --spec 001
    python3 auto-codex/run.py --list

    # Workspace management
    python3 auto-codex/run.py --spec 001 --merge     # Add completed build to project
    python3 auto-codex/run.py --spec 001 --review    # See what was built
    python3 auto-codex/run.py --spec 001 --discard   # Delete build (requires confirmation)

Prerequisites:
    - Codex authentication configured (OPENAI_API_KEY, CODEX_CODE_OAUTH_TOKEN, or CODEX_CONFIG_DIR)
    - Spec created via: python3 auto-codex/runners/spec_runner.py (writes to .auto-codex/specs/)
    - Codex CLI installed (`codex` available on PATH)
"""

import sys

# Python version check - must be before any imports using 3.12+ syntax
if sys.version_info < (3, 12):  # noqa: UP036
    sys.exit(
        f"Error: Auto-Codex requires Python 3.12 or higher.\n"
        f"You are running Python {sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}\n"
        f"\n"
        f"Please upgrade Python: https://www.python.org/downloads/"
    )

import io

# Configure safe encoding on Windows BEFORE any imports that might print
# This handles both TTY and piped output (e.g., from Electron)
if sys.platform == "win32":
    for _stream_name in ("stdout", "stderr"):
        _stream = getattr(sys, _stream_name)
        # Method 1: Try reconfigure (works for TTY)
        if hasattr(_stream, "reconfigure"):
            try:
                _stream.reconfigure(encoding="utf-8", errors="replace")
                continue
            except (AttributeError, io.UnsupportedOperation, OSError):
                pass
        # Method 2: Wrap with TextIOWrapper for piped output
        try:
            if hasattr(_stream, "buffer"):
                _new_stream = io.TextIOWrapper(
                    _stream.buffer,
                    encoding="utf-8",
                    errors="replace",
                    line_buffering=True,
                )
                setattr(sys, _stream_name, _new_stream)
        except (AttributeError, io.UnsupportedOperation, OSError):
            pass
    # Clean up temporary variables
    del _stream_name, _stream
    if "_new_stream" in dir():
        del _new_stream

from cli import main

if __name__ == "__main__":
    main()
