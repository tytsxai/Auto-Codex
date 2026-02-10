#!/usr/bin/env python3
"""
Tests for workflow manager production safety behavior.
"""

import subprocess
from pathlib import Path

import pytest
from core.workflow import WorkflowManager


def _create_worktree_with_change(repo: Path, spec_name: str) -> Path:
    worktree_path = repo / ".worktrees" / spec_name
    subprocess.run(
        ["git", "worktree", "add", "-b", f"feature/{spec_name}", str(worktree_path)],
        cwd=repo,
        capture_output=True,
        check=True,
        text=True,
    )

    changed_file = worktree_path / "feature.txt"
    changed_file.write_text("feature content\n", encoding="utf-8")

    subprocess.run(
        ["git", "add", "feature.txt"],
        cwd=worktree_path,
        capture_output=True,
        check=True,
        text=True,
    )
    subprocess.run(
        ["git", "commit", "-m", "feat: add feature file"],
        cwd=worktree_path,
        capture_output=True,
        check=True,
        text=True,
    )

    return worktree_path


def test_stage_worktree_fails_when_git_add_fails(
    temp_git_repo: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    spec_name = "wf-stage-failure"
    _create_worktree_with_change(temp_git_repo, spec_name)

    manager = WorkflowManager(temp_git_repo)

    original_run = subprocess.run

    def fake_run(*args, **kwargs):
        cmd = args[0] if args else kwargs.get("args", [])
        cwd = kwargs.get("cwd")
        if cmd[:2] == ["git", "add"] and cwd == temp_git_repo:
            return subprocess.CompletedProcess(cmd, 1, "", "simulated add failure")
        return original_run(*args, **kwargs)

    monkeypatch.setattr(subprocess, "run", fake_run)

    result = manager.stage_worktree(spec_name=spec_name, task_id="task-1", auto_cleanup=False)

    assert result.success is False
    assert result.files_staged == []
    assert result.error is not None
    assert "Failed to stage file" in result.error


def test_cleanup_worktree_fails_when_branch_delete_fails(
    temp_git_repo: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    spec_name = "wf-cleanup-failure"
    worktree_path = _create_worktree_with_change(temp_git_repo, spec_name)

    manager = WorkflowManager(temp_git_repo)

    original_run = subprocess.run

    def fake_run(*args, **kwargs):
        cmd = args[0] if args else kwargs.get("args", [])
        cwd = kwargs.get("cwd")
        if cmd[:3] == ["git", "branch", "-D"] and cwd == temp_git_repo:
            return subprocess.CompletedProcess(cmd, 1, "", "simulated branch delete failure")
        return original_run(*args, **kwargs)

    monkeypatch.setattr(subprocess, "run", fake_run)

    with pytest.raises(RuntimeError, match="Failed to delete worktree branch"):
        manager.cleanup_worktree(spec_name)

    assert not worktree_path.exists()
