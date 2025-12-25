from __future__ import annotations

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

        For codex-cli 0.77.0+, uses --sandbox flag instead of legacy
        --allowed-command/--allowed-path flags which are no longer supported.
        """
        args = []
        if self.bypass_sandbox:
            args.append("--dangerously-bypass-approvals-and-sandbox")
        else:
            # codex-cli 0.77.0+ uses --sandbox with predefined modes
            # workspace-write: allows writes within the workspace directory
            args.extend(["--sandbox", "workspace-write"])
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
        - mode: "bypass" | "enforced"
        - sandbox_mode: the --sandbox value used
        - warnings: list of warning messages
        """
        warnings = []

        if self.bypass_sandbox:
            mode = "bypass"
            sandbox_mode = "danger-full-access"
            warnings.append("Sandbox bypassed - all commands allowed without approval")
        else:
            mode = "enforced"
            sandbox_mode = "workspace-write"

        return {
            "mode": mode,
            "sandbox_mode": sandbox_mode,
            "bypass_sandbox": self.bypass_sandbox,
            "warnings": warnings,
        }
