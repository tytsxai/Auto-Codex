from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from typing import Iterable, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from project_analyzer import SecurityProfile

_TOOL_PATH_PATTERN = re.compile(r"^(Read|Write|Edit|Glob|Grep)\((.+)\)$")
_BASH_TOOL_PATTERN = re.compile(r"^Bash\((.*)\)$")


def _dedupe(items: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        if item in seen:
            continue
        seen.add(item)
        result.append(item)
    return result


def _format_list_args(flag: str, values: Iterable[str]) -> list[str]:
    return [f"{flag}={value}" for value in values]


@dataclass
class CodexSecurityConfig:
    """Security configuration for Codex CLI."""

    bypass_sandbox: bool = False
    allowed_commands: list[str] = field(default_factory=list)
    blocked_commands: list[str] = field(default_factory=list)
    allowed_paths: list[str] = field(default_factory=list)
    blocked_paths: list[str] = field(default_factory=list)

    def to_codex_args(self) -> list[str]:
        """Convert to Codex CLI arguments.

        Security flags are sent by default. Set AUTO_CODEX_LEGACY_SECURITY=true
        to disable (for backwards compatibility during transition).
        """
        args = []
        if self.bypass_sandbox:
            args.append("--dangerously-bypass-approvals-and-sandbox")
        # Default: send security flags to Codex CLI
        # Set AUTO_CODEX_LEGACY_SECURITY=true to disable (backwards compat)
        legacy_mode = os.environ.get("AUTO_CODEX_LEGACY_SECURITY", "").strip().lower() in ("1", "true", "yes")
        if not legacy_mode:
            args.extend(_format_list_args("--allowed-command", self.allowed_commands))
            args.extend(_format_list_args("--blocked-command", self.blocked_commands))
            args.extend(_format_list_args("--allowed-path", self.allowed_paths))
            args.extend(_format_list_args("--blocked-path", self.blocked_paths))
        return args

    @classmethod
    def from_claude_settings(cls, settings: dict) -> "CodexSecurityConfig":
        """Convert legacy LLM settings to Codex config."""
        sandbox = settings.get("sandbox", {})
        bypass_sandbox = not sandbox.get("enabled", True)

        permissions = settings.get("permissions", {})
        allow_entries = permissions.get("allow", []) or []

        allowed_paths: list[str] = []
        allowed_commands: list[str] = []

        for entry in allow_entries:
            if not isinstance(entry, str):
                continue
            match = _TOOL_PATH_PATTERN.match(entry)
            if match:
                allowed_paths.append(match.group(2))
                continue
            bash_match = _BASH_TOOL_PATTERN.match(entry)
            if bash_match:
                # Placeholder for bash tool enablement; actual command whitelist
                # still comes from the security profile.
                allowed_commands.append(bash_match.group(1) or "*")

        return cls(
            bypass_sandbox=bypass_sandbox,
            allowed_commands=_dedupe(allowed_commands),
            allowed_paths=_dedupe(allowed_paths),
        )

    @classmethod
    def from_security_profile(
        cls,
        profile: "SecurityProfile",
        allowed_paths: Optional[list[str]] = None,
        blocked_paths: Optional[list[str]] = None,
        bypass_sandbox: bool = False,
    ) -> "CodexSecurityConfig":
        """Convert a project security profile to Codex config."""
        if allowed_paths is None:
            allowed_paths = ["./**"]
        if blocked_paths is None:
            blocked_paths = []
        allowed_commands = sorted(profile.get_all_allowed_commands())
        return cls(
            bypass_sandbox=bypass_sandbox,
            allowed_commands=allowed_commands,
            allowed_paths=_dedupe(allowed_paths),
            blocked_paths=_dedupe(blocked_paths),
        )

    def get_security_status(self) -> dict:
        """
        Return security configuration status for self-check/UI display.

        Returns dict with:
        - mode: "bypass" | "legacy" | "enforced"
        - flags_sent_to_codex: bool
        - warnings: list of warning messages
        """
        warnings = []
        legacy_mode = os.environ.get("AUTO_CODEX_LEGACY_SECURITY", "").strip().lower() in ("1", "true", "yes")
        flags_sent = not legacy_mode

        if self.bypass_sandbox:
            mode = "bypass"
            warnings.append("Sandbox bypassed - all commands allowed without approval")
        elif legacy_mode:
            mode = "legacy"
            warnings.append(
                "Security rules are local pre-check only (AUTO_CODEX_LEGACY_SECURITY=true); "
                "remove this env var to enable Codex CLI enforcement"
            )
        else:
            mode = "enforced"

        return {
            "mode": mode,
            "flags_sent_to_codex": flags_sent,
            "bypass_sandbox": self.bypass_sandbox,
            "allowed_commands_count": len(self.allowed_commands),
            "blocked_commands_count": len(self.blocked_commands),
            "warnings": warnings,
        }
