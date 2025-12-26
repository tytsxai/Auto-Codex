from __future__ import annotations

from agents.tools_pkg.permissions import get_codex_tool_permissions
from project_analyzer import SecurityProfile
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


def test_to_codex_args_bypass_mode() -> None:
    """Test that bypass mode generates correct args for codex-cli 0.77.0+."""
    config = CodexSecurityConfig(
        bypass_sandbox=True,
        allowed_commands=["git", "pytest"],
        blocked_commands=["rm"],
        allowed_paths=["./**"],
        blocked_paths=["/"],
    )

    args = config.to_codex_args()

    assert "--dangerously-bypass-approvals-and-sandbox" in args
    # codex-cli 0.77.0+ doesn't use --allowed-command flags
    assert "--sandbox" not in args


def test_to_codex_args_sandbox_mode() -> None:
    """Test that non-bypass mode uses --sandbox workspace-write."""
    config = CodexSecurityConfig(
        bypass_sandbox=False,
        allowed_commands=["git"],
        allowed_paths=["./**"],
    )

    args = config.to_codex_args()

    assert "--dangerously-bypass-approvals-and-sandbox" not in args
    assert "--sandbox" in args
    assert "workspace-write" in args


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
