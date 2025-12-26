"""
Security Hooks
==============

Pre-tool-use hooks that validate bash commands for security.
Main enforcement point for the security system.
"""

import os
from datetime import datetime
from pathlib import Path
from typing import Any

from core.debug import debug_warning
from project_analyzer import BASE_COMMANDS, SecurityProfile, is_command_allowed

from .parser import extract_commands, get_command_for_validation, split_command_segments
from .profile import get_security_profile
from .validator import VALIDATORS

# Audit log file path (optional, set via environment)
AUDIT_LOG_FILE = os.environ.get("AUTO_CODEX_AUDIT_LOG")


def _audit_log(event_type: str, command: str, reason: str, allowed: bool) -> None:
    """
    Write security audit log entry.

    Logs to:
    1. Debug output (if DEBUG=true)
    2. Audit log file (if AUTO_CODEX_AUDIT_LOG is set)
    """
    timestamp = datetime.now().isoformat()
    status = "ALLOWED" if allowed else "BLOCKED"

    # Always log blocked commands to debug
    if not allowed:
        debug_warning("security", f"Command {status}: {command[:100]}", reason=reason)

    # Write to audit log file if configured
    if AUDIT_LOG_FILE:
        try:
            log_entry = f"{timestamp}|{status}|{event_type}|{reason}|{command}\n"
            with open(AUDIT_LOG_FILE, "a") as f:
                f.write(log_entry)
        except OSError:
            pass  # Don't fail on audit log errors


async def bash_security_hook(
    input_data: dict[str, Any],
    tool_use_id: str | None = None,
    context: Any | None = None,
) -> dict[str, Any]:
    """
    Pre-tool-use hook that validates bash commands using dynamic allowlist.

    This is the main security enforcement point. It:
    1. Extracts command names from the command string
    2. Checks each command against the project's security profile
    3. Runs additional validation for sensitive commands
    4. Blocks disallowed commands with clear error messages

    Args:
        input_data: Dict containing tool_name and tool_input
        tool_use_id: Optional tool use ID
        context: Optional context

    Returns:
        Empty dict to allow, or {"decision": "block", "reason": "..."} to block
    """
    if input_data.get("tool_name") != "Bash":
        return {}

    command = input_data.get("tool_input", {}).get("command", "")
    if not command:
        return {}

    # Get the working directory from context or use current directory
    # In the actual client, this would be set by the LLM client adapter
    cwd = os.getcwd()
    if context and hasattr(context, "cwd"):
        cwd = context.cwd

    # Get or create security profile
    # Note: In actual use, spec_dir would be passed through context
    try:
        profile = get_security_profile(Path(cwd))
    except Exception as e:
        # If profile creation fails, fall back to base commands only
        print(f"Warning: Could not load security profile: {e}")
        profile = SecurityProfile()
        profile.base_commands = BASE_COMMANDS.copy()

    # Extract all commands from the command string
    commands = extract_commands(command)

    if not commands:
        # Could not parse - fail safe by blocking
        return {
            "decision": "block",
            "reason": f"Could not parse command for security validation: {command}",
        }

    # Split into segments for per-command validation
    segments = split_command_segments(command)

    # Get all allowed commands
    allowed = profile.get_all_allowed_commands()

    # Check each command against the allowlist
    for cmd in commands:
        # Check if command is allowed
        is_allowed, reason = is_command_allowed(cmd, profile)

        if not is_allowed:
            return {
                "decision": "block",
                "reason": reason,
            }

        # Additional validation for sensitive commands
        if cmd in VALIDATORS:
            cmd_segment = get_command_for_validation(cmd, segments)
            if not cmd_segment:
                cmd_segment = command

            validator = VALIDATORS[cmd]
            allowed, reason = validator(cmd_segment)
            if not allowed:
                return {"decision": "block", "reason": reason}

    return {}


def validate_command(
    command: str,
    project_dir: Path | None = None,
) -> tuple[bool, str]:
    """
    Validate a command string (for testing/debugging).

    Args:
        command: Full command string to validate
        project_dir: Optional project directory (uses cwd if not provided)

    Returns:
        (is_allowed, reason) tuple
    """
    if project_dir is None:
        project_dir = Path.cwd()

    profile = get_security_profile(project_dir)
    commands = extract_commands(command)

    if not commands:
        return False, "Could not parse command"

    segments = split_command_segments(command)

    for cmd in commands:
        is_allowed_result, reason = is_command_allowed(cmd, profile)
        if not is_allowed_result:
            return False, reason

        if cmd in VALIDATORS:
            cmd_segment = get_command_for_validation(cmd, segments)
            if not cmd_segment:
                cmd_segment = command

            validator = VALIDATORS[cmd]
            allowed, reason = validator(cmd_segment)
            if not allowed:
                return False, reason

    return True, ""
