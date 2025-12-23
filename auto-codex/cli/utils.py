"""
CLI Utilities
==============

Shared utility functions for the Auto Codex CLI.
"""

import os
import sys
from pathlib import Path

# Ensure parent directory is in path for imports (before other imports)
_PARENT_DIR = Path(__file__).parent.parent
if str(_PARENT_DIR) not in sys.path:
    sys.path.insert(0, str(_PARENT_DIR))

from core.auth import (
    get_auth_token,
    get_auth_token_source,
    get_deprecated_auth_token,
    is_valid_codex_config_dir,
    is_valid_codex_oauth_token,
    is_valid_openai_api_key,
)
from dotenv import load_dotenv
from graphiti_config import get_graphiti_status
from linear_integration import LinearManager
from linear_updater import is_linear_enabled
from spec.pipeline import get_specs_dir
from ui import (
    Icons,
    bold,
    box,
    icon,
    muted,
)

# Configuration
# Default model - can be overridden via AUTO_BUILD_MODEL environment variable.
# Reasoning depth is configured at runtime via `model_reasoning_effort` (low/medium/high/xhigh),
# not by encoding it into the model name.
DEFAULT_MODEL = os.environ.get("AUTO_BUILD_MODEL", "gpt-5.2-codex")


def setup_environment() -> Path:
    """
    Set up the environment and return the script directory.

    Returns:
        Path to the auto-codex directory
    """
    # Add auto-codex directory to path for imports
    script_dir = Path(__file__).parent.parent.resolve()
    sys.path.insert(0, str(script_dir))

    # Load .env file - check both auto-codex/ and dev/auto-codex/ locations
    env_file = script_dir / ".env"
    dev_env_file = script_dir.parent / "dev" / "auto-codex" / ".env"
    if env_file.exists():
        load_dotenv(env_file)
    elif dev_env_file.exists():
        load_dotenv(dev_env_file)

    return script_dir


def find_spec(
    project_dir: Path, spec_identifier: str, dev_mode: bool = False
) -> Path | None:
    """
    Find a spec by number or full name.

    Args:
        project_dir: Project root directory
        spec_identifier: Either "001" or "001-feature-name"
        dev_mode: If True, use dev/auto-codex/specs/

    Returns:
        Path to spec folder, or None if not found
    """
    specs_dir = get_specs_dir(project_dir, dev_mode)

    if not specs_dir.exists():
        return None

    # Try exact match first
    exact_path = specs_dir / spec_identifier
    if exact_path.exists() and (exact_path / "spec.md").exists():
        return exact_path

    # Try matching by number prefix
    for spec_folder in specs_dir.iterdir():
        if spec_folder.is_dir() and spec_folder.name.startswith(spec_identifier + "-"):
            if (spec_folder / "spec.md").exists():
                return spec_folder

    return None


def validate_environment(spec_dir: Path) -> bool:
    """
    Validate that the environment is set up correctly.

    Returns:
        True if valid, False otherwise (with error messages printed)
    """
    valid = True

    # Check for Codex authentication
    openai_key = os.environ.get("OPENAI_API_KEY", "")
    oauth_token = os.environ.get("CODEX_CODE_OAUTH_TOKEN", "")
    codex_config_dir = os.environ.get("CODEX_CONFIG_DIR", "")
    auth_token = get_auth_token()
    source = get_auth_token_source()

    if openai_key and not is_valid_openai_api_key(openai_key):
        if not auth_token or source == "OPENAI_API_KEY":
            print("Error: Invalid OPENAI_API_KEY format")
            print("Expected a non-empty key without whitespace (OpenAI keys often start with 'sk-').")
            valid = False
        else:
            print("Warning: Invalid OPENAI_API_KEY format ignored (another auth source is configured).")

    if oauth_token and not is_valid_codex_oauth_token(oauth_token):
        if not auth_token or source == "CODEX_CODE_OAUTH_TOKEN":
            print("Error: Invalid CODEX_CODE_OAUTH_TOKEN format")
            print("Expected a non-empty token without whitespace.")
            valid = False
        else:
            print("Warning: Invalid CODEX_CODE_OAUTH_TOKEN ignored (another auth source is configured).")

    if codex_config_dir and not is_valid_codex_config_dir(codex_config_dir):
        if not auth_token or source == "CODEX_CONFIG_DIR":
            print("Error: Invalid CODEX_CONFIG_DIR")
            print(f"Directory does not exist: {codex_config_dir}")
            valid = False
        else:
            print("Warning: CODEX_CONFIG_DIR does not exist (another auth source is configured).")

    if not auth_token:
        deprecated_token = get_deprecated_auth_token()
        if deprecated_token:
            print("Error: Detected legacy OAuth token (CLAUDE_CODE_OAUTH_TOKEN)")
            print("Please migrate to one of: OPENAI_API_KEY, CODEX_CODE_OAUTH_TOKEN, or CODEX_CONFIG_DIR.")
        else:
            print("Error: No Codex authentication found")
            print("\nConfigure one of:")
            print("- OPENAI_API_KEY (API key)")
            print("- CODEX_CODE_OAUTH_TOKEN (OAuth token)")
            print("- CODEX_CONFIG_DIR (Codex config directory)")
        valid = False
    else:
        # Show which auth source is being used
        if source:
            print(f"Auth: {source}")

    # Check for spec.md in spec directory
    spec_file = spec_dir / "spec.md"
    if not spec_file.exists():
        print(f"\nError: spec.md not found in {spec_dir}")
        valid = False

    # Check Linear integration (optional but show status)
    if is_linear_enabled():
        print("Linear integration: ENABLED")
        # Show Linear project status if initialized
        project_dir = spec_dir.parent.parent
        if (
            spec_dir.parent.name == "specs"
            and spec_dir.parent.parent.name in (".auto-codex", ".auto-claude")
        ):
            project_dir = spec_dir.parent.parent.parent
        linear_manager = LinearManager(spec_dir, project_dir)
        if linear_manager.is_initialized:
            summary = linear_manager.get_progress_summary()
            print(f"  Project: {summary.get('project_name', 'Unknown')}")
            print(
                f"  Issues: {summary.get('mapped_subtasks', 0)}/{summary.get('total_subtasks', 0)} mapped"
            )
        else:
            print("  Status: Will be initialized during planner session")
    else:
        print("Linear integration: DISABLED (set LINEAR_API_KEY to enable)")

    # Check Graphiti integration (optional but show status)
    graphiti_status = get_graphiti_status()
    if graphiti_status["available"]:
        print("Graphiti memory: ENABLED")
        print(f"  Database: {graphiti_status['database']}")
        print(f"  Host: {graphiti_status['host']}:{graphiti_status['port']}")
    elif graphiti_status["enabled"]:
        print(
            f"Graphiti memory: CONFIGURED but unavailable ({graphiti_status['reason']})"
        )
    else:
        print("Graphiti memory: DISABLED (set GRAPHITI_ENABLED=true to enable)")

    print()
    return valid


def print_banner() -> None:
    """Print the Auto-Build banner."""
    content = [
        bold(f"{icon(Icons.LIGHTNING)} AUTO-BUILD FRAMEWORK"),
        "",
        "Autonomous Multi-Session Coding Agent",
        muted("Subtask-Based Implementation with Phase Dependencies"),
    ]
    print()
    print(box(content, width=70, style="heavy"))


def get_project_dir(provided_dir: Path | None) -> Path:
    """
    Determine the project directory.

    Args:
        provided_dir: User-provided project directory (or None)

    Returns:
        Resolved project directory path
    """
    if provided_dir:
        return provided_dir.resolve()

    project_dir = Path.cwd()

    # Auto-detect if running from within auto-codex directory (the source code)
    if project_dir.name == "auto-codex" and (project_dir / "run.py").exists():
        # Running from within auto-codex/ source directory, go up 1 level
        project_dir = project_dir.parent

    return project_dir
