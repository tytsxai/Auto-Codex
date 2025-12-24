"""
Auto Codex CLI Package
======================

Command-line interface for the Auto Codex autonomous coding framework.

This package provides a modular CLI structure:
- main.py: Argument parsing and command routing
- spec_commands.py: Spec listing and management
- build_commands.py: Build execution and follow-up tasks
- workspace_commands.py: Workspace management (merge, review, discard)
- qa_commands.py: QA validation commands
- utils.py: Shared utilities and configuration
"""

# Lazy import to avoid RuntimeWarning when running as module
def main():
    from .main import main as _main
    return _main()

__all__ = ["main"]
