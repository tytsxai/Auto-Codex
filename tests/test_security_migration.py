from __future__ import annotations

from project_analyzer import SecurityProfile

from agents.tools_pkg.permissions import get_codex_tool_permissions
from security import CodexSecurityConfig, validate_command


def test_from_claude_settings_maps_paths_and_bash() -> None:
    settings = {
        "sandbox": {"enabled": False},
        "permissions": {
            "allow": [
                "Read(./**)",
                "Write(./**)",
                "Edit(./**)",
                "Bash(*)",
                "mcp__context7__resolve-library-id",
            ]
        },
    }

    config = CodexSecurityConfig.from_claude_settings(settings)

    assert config.bypass_sandbox is True
    assert config.allowed_paths == ["./**"]
    assert config.allowed_commands == ["*"]


def test_from_security_profile_maps_allowed_commands() -> None:
    profile = SecurityProfile(
        base_commands={"ls", "cat"},
        stack_commands={"pytest"},
        script_commands=set(),
        custom_commands={"make"},
    )

    config = CodexSecurityConfig.from_security_profile(profile, allowed_paths=["./**"])

    assert config.allowed_commands == ["cat", "ls", "make", "pytest"]
    assert config.allowed_paths == ["./**"]


def test_to_codex_args_includes_bypass_and_lists(monkeypatch) -> None:
    # Default behavior now sends flags (no env var needed)
    monkeypatch.delenv("AUTO_CODEX_LEGACY_SECURITY", raising=False)
    config = CodexSecurityConfig(
        bypass_sandbox=True,
        allowed_commands=["git", "pytest"],
        blocked_commands=["rm"],
        allowed_paths=["./**"],
        blocked_paths=["/"],
    )

    args = config.to_codex_args()

    assert "--dangerously-bypass-approvals-and-sandbox" in args
    assert "--allowed-command=git" in args
    assert "--allowed-command=pytest" in args
    assert "--blocked-command=rm" in args
    assert "--allowed-path=./**" in args
    assert "--blocked-path=/" in args


def test_validate_command_whitelist(python_project) -> None:
    allowed, reason = validate_command("ls", python_project)
    assert allowed is True
    assert reason == ""

    allowed, reason = validate_command("shutdown now", python_project)
    assert allowed is False
    assert "not in the allowed commands" in reason


def test_codex_tool_permissions_passthrough() -> None:
    permissions = get_codex_tool_permissions("coder")

    assert permissions.allowed
    assert permissions.blocked == []
