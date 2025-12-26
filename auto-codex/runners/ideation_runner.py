#!/usr/bin/env python3
"""
Ideation Creation Orchestrator (Facade)
========================================

This is a facade that maintains backward compatibility with the original
ideation_runner.py interface while delegating to the refactored modular
components in the ideation/ package.

AI-powered ideation generation for projects.
Analyzes project context, existing features, and generates three types of ideas:
1. Low-Hanging Fruit - Quick wins building on existing patterns
2. UI/UX Improvements - Visual and interaction enhancements
3. High-Value Features - Strategic features for target users

Usage:
    python3 auto-codex/ideation_runner.py --project /path/to/project
    python3 auto-codex/ideation_runner.py --project /path/to/project --types low_hanging_fruit,high_value_features
    python3 auto-codex/ideation_runner.py --project /path/to/project --refresh
"""

import asyncio
import json
import os
import sys
from pathlib import Path

# Add auto-codex to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Load .env file from auto-codex/ directory
from dotenv import load_dotenv

env_file = Path(__file__).parent.parent / ".env"
if env_file.exists():
    load_dotenv(env_file)

# Import from refactored modules
from core.auth import ensure_auth_hydrated
from debug import debug, debug_error
from evals.ideation_eval import evaluate_ideation
from ideation import (
    IdeationConfig,
    IdeationOrchestrator,
    IdeationPhaseResult,
)
from ideation.generator import IDEATION_TYPE_LABELS, IDEATION_TYPES
from phase_config import normalize_thinking_level

# Re-export for backward compatibility
__all__ = [
    "IdeationOrchestrator",
    "IdeationConfig",
    "IdeationPhaseResult",
    "IDEATION_TYPES",
    "IDEATION_TYPE_LABELS",
]


def main():
    """CLI entry point."""
    import argparse

    # Ensure authentication is hydrated from ~/.codex/auth.json if needed
    # This must happen early, before any Codex CLI operations
    auth_status = ensure_auth_hydrated()
    if auth_status.is_authenticated:
        debug(
            "ideation_runner",
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
        debug_error("ideation_runner", "Authentication failed", errors=auth_status.errors)
        print(error_msg, file=sys.stderr)
        sys.exit(1)

    parser = argparse.ArgumentParser(
        description="AI-powered ideation generation",
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
        help="Output directory for ideation files (default: project/auto-codex/ideation)",
    )
    parser.add_argument(
        "--types",
        type=str,
        help=f"Comma-separated ideation types to run (options: {','.join(IDEATION_TYPES)})",
    )
    parser.add_argument(
        "--no-roadmap",
        action="store_true",
        help="Don't include roadmap context",
    )
    parser.add_argument(
        "--no-kanban",
        action="store_true",
        help="Don't include kanban context",
    )
    parser.add_argument(
        "--max-ideas",
        type=int,
        default=5,
        help="Maximum ideas per type (default: 5)",
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
        help="Force regeneration even if ideation exists",
    )
    parser.add_argument(
        "--append",
        action="store_true",
        help="Append new ideas to existing session instead of replacing",
    )
    parser.add_argument(
        "--eval",
        action="store_true",
        help="Run basic evaluation after generation",
    )
    parser.add_argument(
        "--judge",
        action="store_true",
        help="Use LLM judge during evaluation (requires --eval)",
    )

    args = parser.parse_args()
    args.thinking_level = normalize_thinking_level(args.thinking_level)

    # Validate project directory
    project_dir = args.project.resolve()
    if not project_dir.exists():
        print(f"Error: Project directory does not exist: {project_dir}", file=sys.stderr)
        sys.exit(1)

    # Parse types
    enabled_types = None
    if args.types:
        enabled_types = [t.strip() for t in args.types.split(",")]
        invalid_types = [t for t in enabled_types if t not in IDEATION_TYPES]
        if invalid_types:
            print(f"Error: Invalid ideation types: {invalid_types}", file=sys.stderr)
            print(f"Valid types: {IDEATION_TYPES}", file=sys.stderr)
            sys.exit(1)

    orchestrator = IdeationOrchestrator(
        project_dir=project_dir,
        output_dir=args.output,
        enabled_types=enabled_types,
        include_roadmap_context=not args.no_roadmap,
        include_kanban_context=not args.no_kanban,
        max_ideas_per_type=args.max_ideas,
        model=args.model,
        thinking_level=args.thinking_level,
        refresh=args.refresh,
        append=args.append,
    )

    try:
        success = asyncio.run(orchestrator.run())
        if success and args.eval:
            output_dir = args.output or (project_dir / ".auto-codex" / "ideation")
            ideation_path = Path(output_dir) / "ideation.json"
            eval_result = evaluate_ideation(
                ideation_path,
                args.model or os.environ.get("AUTO_BUILD_MODEL", "gpt-5.2-codex"),
                args.thinking_level,
                use_judge=args.judge,
            )
            eval_path = Path(output_dir) / "ideation_eval.json"
            try:
                with open(eval_path, "w") as f:
                    json.dump(eval_result, f, indent=2)
                print(f"Ideation evaluation saved to: {eval_path}", file=sys.stderr)
            except Exception as e:
                print(f"Failed to write ideation_eval.json: {e}", file=sys.stderr)
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\nIdeation generation interrupted.", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
