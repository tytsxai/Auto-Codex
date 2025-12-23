#!/usr/bin/env python3
"""
Roadmap Creation Orchestrator
=============================

AI-powered roadmap generation for projects.
Analyzes project structure, understands target audience, and generates
a strategic feature roadmap.

Usage:
    python3 auto-codex/roadmap_runner.py --project /path/to/project
    python3 auto-codex/roadmap_runner.py --project /path/to/project --refresh
    python3 auto-codex/roadmap_runner.py --project /path/to/project --output roadmap.json
"""

import asyncio
import sys
import traceback
from pathlib import Path

# Add auto-codex to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Load .env file from auto-codex/ directory
from dotenv import load_dotenv

env_file = Path(__file__).parent.parent / ".env"
if env_file.exists():
    load_dotenv(env_file)

from debug import debug, debug_error, debug_warning
from core.debug import is_debug_enabled
from core.auth import ensure_auth_hydrated

# Import from refactored roadmap package
from runners.roadmap import RoadmapOrchestrator
from phase_config import normalize_thinking_level


def main():
    """CLI entry point."""
    import argparse

    # Ensure authentication is hydrated from ~/.codex/auth.json if needed
    # This must happen early, before any Codex CLI operations
    auth_status = ensure_auth_hydrated()
    if auth_status.is_authenticated:
        debug(
            "roadmap_runner",
            "Authentication verified",
            source=auth_status.source,
            api_key_set=auth_status.api_key_set,
            base_url_set=auth_status.base_url_set,
        )
    else:
        # Provide actionable error message with checked sources
        checked_sources = [
            "OPENAI_API_KEY (environment variable)",
            "CODEX_CODE_OAUTH_TOKEN (environment variable)",
            "CODEX_CONFIG_DIR (environment variable)",
            "~/.codex/auth.json",
            "~/.codex/config.toml",
        ]
        error_msg = f"""No Codex authentication found.

Checked sources:
{chr(10).join(f'  - {s}' for s in checked_sources)}

Configure one of:
- Create ~/.codex/auth.json with your API key
- Set OPENAI_API_KEY environment variable
- Set CODEX_CODE_OAUTH_TOKEN environment variable
- Set CODEX_CONFIG_DIR to your Codex config directory

For third-party activation channels (e.g., yunyi):
Your credentials should be in ~/.codex/auth.json
"""
        debug_error("roadmap_runner", "Authentication failed", errors=auth_status.errors)
        print(error_msg, file=sys.stderr)
        sys.exit(1)

    parser = argparse.ArgumentParser(
        description="AI-powered roadmap generation",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--project",
        type=Path,
        default=Path.cwd(),
        help="Project directory (default: current directory)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Output directory for roadmap files (default: project/auto-codex/roadmap)",
    )
    parser.add_argument(
        "--model",
        type=str,
        default=None,  # Will use AUTO_BUILD_MODEL env var or gpt-5.2-codex
        help="Model to use (default: AUTO_BUILD_MODEL env var or gpt-5.2-codex)",
    )
    parser.add_argument(
        "--thinking-level",
        type=str,
        default="medium",
        choices=["none", "low", "medium", "high", "xhigh", "ultrathink"],
        help="Thinking level for extended reasoning (default: medium)",
    )
    parser.add_argument(
        "--refresh",
        action="store_true",
        help="Force regeneration even if roadmap exists",
    )
    parser.add_argument(
        "--competitor-analysis",
        action="store_true",
        dest="enable_competitor_analysis",
        help="Enable competitor analysis phase",
    )
    parser.add_argument(
        "--refresh-competitor-analysis",
        action="store_true",
        dest="refresh_competitor_analysis",
        help="Force refresh competitor analysis even if it exists (requires --competitor-analysis)",
    )

    args = parser.parse_args()
    args.thinking_level = normalize_thinking_level(args.thinking_level)

    debug(
        "roadmap_runner",
        "CLI invoked",
        project=str(args.project),
        output=str(args.output) if args.output else None,
        model=args.model,
        refresh=args.refresh,
    )

    # Validate project directory
    project_dir = args.project.resolve()
    if not project_dir.exists():
        debug_error(
            "roadmap_runner",
            "Project directory does not exist",
            project_dir=str(project_dir),
        )
        print(f"Error: Project directory does not exist: {project_dir}")
        sys.exit(1)

    debug(
        "roadmap_runner", "Creating RoadmapOrchestrator", project_dir=str(project_dir)
    )

    orchestrator = RoadmapOrchestrator(
        project_dir=project_dir,
        output_dir=args.output,
        model=args.model,
        thinking_level=args.thinking_level,
        refresh=args.refresh,
        enable_competitor_analysis=args.enable_competitor_analysis,
        refresh_competitor_analysis=args.refresh_competitor_analysis,
    )

    try:
        success = asyncio.run(orchestrator.run())
        debug("roadmap_runner", "Roadmap generation finished", success=success)
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        debug_warning("roadmap_runner", "Roadmap generation interrupted by user")
        print("\n\nRoadmap generation interrupted.")
        sys.exit(1)
    except Exception as e:
        debug_error("roadmap_runner", "Roadmap generation failed", error=str(e))
        if is_debug_enabled():
            traceback.print_exc()
        print(str(e), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
