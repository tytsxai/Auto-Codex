#!/usr/bin/env python3
"""
Insights Runner - AI chat for codebase insights using Codex

This script provides an AI-powered chat interface for asking questions
about a codebase. It can also suggest tasks based on the conversation.
"""

import argparse
import asyncio
import json
import sys
from pathlib import Path

# Add auto-codex to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Load .env file from auto-codex/ directory
from dotenv import load_dotenv

env_file = Path(__file__).parent.parent / ".env"
if env_file.exists():
    load_dotenv(env_file)

from core.auth import get_auth_token, ensure_auth_hydrated
from core.client import create_client
from providers.codex_cli import find_codex_path, get_gui_env
from phase_config import get_thinking_budget, normalize_thinking_level
from debug import (
    debug,
    debug_detailed,
    debug_error,
    debug_section,
    debug_success,
    debug_warning,
)


def load_project_context(project_dir: str) -> str:
    """Load project context for the AI."""
    context_parts = []

    # Load project index if available (from .auto-codex - the installed instance)
    index_path = Path(project_dir) / ".auto-codex" / "project_index.json"
    if index_path.exists():
        try:
            with open(index_path) as f:
                index = json.load(f)
            # Summarize the index for context
            summary = {
                "project_root": index.get("project_root", ""),
                "project_type": index.get("project_type", "unknown"),
                "services": list(index.get("services", {}).keys()),
                "infrastructure": index.get("infrastructure", {}),
            }
            context_parts.append(
                f"## Project Structure\n```json\n{json.dumps(summary, indent=2)}\n```"
            )
        except Exception as e:
            debug_warning(
                "insights",
                f"Failed to load project index from {index_path}",
                error=str(e),
            )

    # Load roadmap if available
    roadmap_path = Path(project_dir) / ".auto-codex" / "roadmap" / "roadmap.json"
    if roadmap_path.exists():
        try:
            with open(roadmap_path) as f:
                roadmap = json.load(f)
            # Summarize roadmap
            features = roadmap.get("features", [])
            feature_summary = [
                {"title": f.get("title", ""), "status": f.get("status", "")}
                for f in features[:10]
            ]
            context_parts.append(
                f"## Roadmap Features\n```json\n{json.dumps(feature_summary, indent=2)}\n```"
            )
        except Exception as e:
            debug_warning(
                "insights",
                f"Failed to load roadmap from {roadmap_path}",
                error=str(e),
            )

    # Load existing tasks
    tasks_path = Path(project_dir) / ".auto-codex" / "specs"
    if tasks_path.exists():
        try:
            task_dirs = [d for d in tasks_path.iterdir() if d.is_dir()]
            task_names = [d.name for d in task_dirs[:10]]
            if task_names:
                context_parts.append(
                    "## Existing Tasks/Specs\n- " + "\n- ".join(task_names)
                )
        except Exception as e:
            debug_warning(
                "insights",
                f"Failed to load tasks/specs from {tasks_path}",
                error=str(e),
            )

    return (
        "\n\n".join(context_parts)
        if context_parts
        else "No project context available yet."
    )


def build_system_prompt(project_dir: str) -> str:
    """Build the system prompt for the insights agent."""
    context = load_project_context(project_dir)

    return f"""You are an AI assistant helping developers understand and work with their codebase.
You have access to the following project context:

{context}

Your capabilities:
1. Answer questions about the codebase structure, patterns, and architecture
2. Suggest improvements, features, or bug fixes based on the code
3. Help plan implementation of new features
4. Provide code examples and explanations

When the user asks you to create a task, wants to turn the conversation into a task, or when you believe creating a task would be helpful, output a task suggestion in this exact format on a SINGLE LINE:
__TASK_SUGGESTION__:{{"title": "Task title here", "description": "Detailed description of what the task involves", "metadata": {{"category": "feature", "complexity": "medium", "impact": "medium"}}}}

Valid categories: feature, bug_fix, refactoring, documentation, security, performance, ui_ux, infrastructure, testing
Valid complexity: trivial, small, medium, large, complex
Valid impact: low, medium, high, critical

Be conversational and helpful. Focus on providing actionable insights and clear explanations.
Keep responses concise but informative."""


async def run_with_client(
    project_dir: str,
    message: str,
    history: list,
    model: str = "gpt-5.2-codex",
    thinking_level: str = "medium",
) -> None:
    """Run the chat using the Codex client adapter with streaming."""
    if not get_auth_token():
        print(
            "No authentication token found, falling back to simple mode",
            file=sys.stderr,
        )
        run_simple(project_dir, message, history, model)
        return

    system_prompt = build_system_prompt(project_dir)
    project_path = Path(project_dir).resolve()

    # Build conversation context from history
    conversation_context = ""
    for msg in history[:-1]:  # Exclude the latest message
        role = "User" if msg.get("role") == "user" else "Assistant"
        conversation_context += f"\n{role}: {msg['content']}\n"

    # Build the full prompt with conversation history
    full_prompt = message
    if conversation_context.strip():
        full_prompt = f"""Previous conversation:
{conversation_context}

Current question: {message}"""

    debug(
        "insights_runner",
        "Using model configuration",
        model=model,
        thinking_level=thinking_level,
    )

    try:
        # Create Codex client with appropriate settings for insights
        client = create_client(
            project_dir=project_path,
            spec_dir=None,
            model=model,
            agent_type="planner",
            max_thinking_tokens=get_thinking_budget(thinking_level),
        )

        # Use async context manager pattern
        async with client:
            # Send the query
            await client.query(f"{system_prompt}\n\n{full_prompt}")

            # Stream the response
            response_text = ""
            current_tool = None

            async for msg in client.receive_response():
                msg_type = type(msg).__name__
                debug_detailed("insights_runner", "Received message", msg_type=msg_type)

                if msg_type == "AssistantMessage" and hasattr(msg, "content"):
                    for block in msg.content:
                        block_type = type(block).__name__
                        debug_detailed(
                            "insights_runner", "Processing block", block_type=block_type
                        )
                        if block_type == "TextBlock" and hasattr(block, "text"):
                            text = block.text
                            debug_detailed(
                                "insights_runner", "Text block", text_length=len(text)
                            )
                            # Print text with newline to ensure proper line separation for parsing
                            print(text, flush=True)
                            response_text += text
                        elif block_type == "ToolUseBlock" and hasattr(block, "name"):
                            # Emit tool start marker for UI feedback
                            tool_name = block.name
                            tool_input = ""

                            # Extract a brief description of what the tool is doing
                            if hasattr(block, "input") and block.input:
                                inp = block.input
                                if isinstance(inp, dict):
                                    if "pattern" in inp:
                                        tool_input = f"pattern: {inp['pattern']}"
                                    elif "file_path" in inp:
                                        # Shorten path for display
                                        fp = inp["file_path"]
                                        if len(fp) > 50:
                                            fp = "..." + fp[-47:]
                                        tool_input = fp
                                    elif "path" in inp:
                                        tool_input = inp["path"]

                            current_tool = tool_name
                            print(
                                f"__TOOL_START__:{json.dumps({'name': tool_name, 'input': tool_input})}",
                                flush=True,
                            )

                elif msg_type == "UserMessage" and hasattr(msg, "content"):
                    for block in msg.content:
                        block_type = type(block).__name__
                        if block_type == "ToolResultBlock" and current_tool:
                            print(
                                f"__TOOL_END__:{json.dumps({'name': current_tool})}",
                                flush=True,
                            )
                            current_tool = None

            # Ensure we have a newline at the end
            if response_text and not response_text.endswith("\n"):
                print()

            debug(
                "insights_runner",
                "Response complete",
                response_length=len(response_text),
            )

    except Exception as e:
        print(f"Error using Codex client: {e}", file=sys.stderr)
        import traceback

        traceback.print_exc(file=sys.stderr)
        run_simple(project_dir, message, history, model)


def run_simple(project_dir: str, message: str, history: list, model: str | None = None) -> None:
    """Simple fallback mode without Codex client - uses subprocess to call codex."""
    import subprocess

    system_prompt = build_system_prompt(project_dir)

    # Build conversation context
    conversation_context = ""
    for msg in history[:-1]:
        role = "User" if msg.get("role") == "user" else "Assistant"
        conversation_context += f"\n{role}: {msg['content']}\n"

    # Create the full prompt
    full_prompt = f"""{system_prompt}

Previous conversation:
{conversation_context}

User: {message}
Assistant:"""

    try:
        # Use Codex CLI in non-interactive mode. The Electron UI expects plain text
        # on stdout (it does not parse Codex JSONL events).
        codex_path = find_codex_path() or "codex"
        cmd = [
            codex_path,
            "exec",
            "--skip-git-repo-check",
            "-C",
            project_dir,
        ]
        if model:
            cmd.extend(["-m", model])
        cmd.append("-")
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=project_dir,
            timeout=120,
            input=full_prompt,
            env=get_gui_env(),
        )

        if result.returncode == 0:
            # Print assistant response only (no JSONL / markers).
            print(result.stdout, end="")
        else:
            # Fallback response if codex CLI fails (include a brief, non-sensitive error).
            err = (result.stderr or "").strip()
            if err:
                err = "\n".join(err.splitlines()[-8:])  # keep tail; avoids huge dumps
                err = f"\n\nCodex CLI error (tail):\n{err}"
            print(
                "Sorry, I could not reach Codex to handle your request.\n\n"
                f"Your question was: {message}\n\n"
                "Please check:\n"
                "- Codex authentication (OPENAI_API_KEY, CODEX_CODE_OAUTH_TOKEN, or CODEX_CONFIG_DIR)\n"
                "- Codex CLI is installed and available on PATH\n"
                "- If this is a new directory, initialize git (optional)\n"
                f"{err}"
            )

    except subprocess.TimeoutExpired:
        print("Request timed out. Try a shorter question or retry later.")
    except FileNotFoundError:
        print("Codex CLI not found. Please install `codex` and ensure it is on PATH.")
    except Exception as e:
        print(f"Error: {e}")


def main():
    parser = argparse.ArgumentParser(description="Insights AI Chat Runner")
    parser.add_argument("--project-dir", required=True, help="Project directory path")
    parser.add_argument("--message", required=True, help="User message")
    parser.add_argument("--history", default="[]", help="JSON conversation history")
    parser.add_argument(
        "--history-file", help="Path to JSON file containing conversation history"
    )
    parser.add_argument(
        "--model",
        default="gpt-5.2-codex",
        help="Codex model ID (default: gpt-5.2-codex)",
    )
    parser.add_argument(
        "--thinking-level",
        default="medium",
        choices=["none", "low", "medium", "high", "xhigh", "ultrathink"],
        help="Thinking level for extended reasoning (default: medium)",
    )
    args = parser.parse_args()

    debug_section("insights_runner", "Starting Insights Chat")

    # Ensure authentication is hydrated from ~/.codex/auth.json if needed
    # This must happen early, before any Codex CLI operations
    auth_status = ensure_auth_hydrated()
    if auth_status.is_authenticated:
        debug(
            "insights_runner",
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
        debug_error("insights_runner", "Authentication failed", errors=auth_status.errors)
        print(error_msg, file=sys.stderr)
        sys.exit(1)

    project_dir = args.project_dir
    user_message = args.message
    model = args.model
    thinking_level = normalize_thinking_level(args.thinking_level)

    debug(
        "insights_runner",
        "Arguments",
        project_dir=project_dir,
        message_length=len(user_message),
        model=model,
        thinking_level=thinking_level,
    )

    # Load history from file if provided, otherwise parse inline JSON
    try:
        if args.history_file:
            debug(
                "insights_runner", "Loading history from file", file=args.history_file
            )
            with open(args.history_file, encoding="utf-8") as f:
                history = json.load(f)
            debug_detailed(
                "insights_runner",
                "Loaded history from file",
                history_length=len(history),
            )
        else:
            history = json.loads(args.history)
            debug_detailed(
                "insights_runner", "Parsed inline history", history_length=len(history)
            )
    except (json.JSONDecodeError, FileNotFoundError, OSError) as e:
        debug_error("insights_runner", f"Failed to load history: {e}")
        history = []

    # Run the async SDK function
    debug("insights_runner", "Running SDK query")
    asyncio.run(
        run_with_client(project_dir, user_message, history, model, thinking_level)
    )
    debug_success("insights_runner", "Query completed")


if __name__ == "__main__":
    main()
