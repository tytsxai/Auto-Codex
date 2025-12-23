#!/usr/bin/env python3
"""
Workspace Display
=================

Functions for displaying workspace information and build summaries.
"""

import subprocess
from datetime import datetime, timezone
from pathlib import Path

from ui import bold, error, info, print_status, python_cmd, success, warning
from worktree import WorktreeManager


def get_worktree_last_activity(worktree_path: Path) -> tuple[datetime | None, int | None]:
    """
    Get the last commit date and days since last activity for a worktree.

    Args:
        worktree_path: Path to the worktree

    Returns:
        Tuple of (last_commit_date, days_since_last_activity)
    """
    try:
        result = subprocess.run(
            ["git", "log", "-1", "--format=%cI"],
            cwd=worktree_path,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        if result.returncode == 0 and result.stdout.strip():
            last_commit_str = result.stdout.strip()
            last_commit = datetime.fromisoformat(last_commit_str.replace("Z", "+00:00"))
            now = datetime.now(timezone.utc)
            days_since = (now - last_commit).days
            return last_commit, days_since
    except Exception:
        pass
    return None, None


def check_stale_worktrees(
    project_dir: Path, stale_days: int = 7
) -> list[dict]:
    """
    Check for stale worktrees that haven't been modified in X days.

    Args:
        project_dir: Project root directory
        stale_days: Number of days after which a worktree is considered stale

    Returns:
        List of stale worktree info dicts
    """
    manager = WorktreeManager(project_dir)
    worktrees = manager.list_all_worktrees()
    stale = []

    for wt in worktrees:
        last_commit, days_since = get_worktree_last_activity(wt.path)
        if days_since is not None and days_since >= stale_days:
            stale.append({
                "spec_name": wt.spec_name,
                "path": str(wt.path),
                "branch": wt.branch,
                "days_since_activity": days_since,
                "last_commit": last_commit.isoformat() if last_commit else None,
            })

    return stale


def show_stale_worktree_warning(project_dir: Path, stale_days: int = 7) -> bool:
    """
    Show a warning if there are stale worktrees.

    Args:
        project_dir: Project root directory
        stale_days: Number of days after which a worktree is considered stale

    Returns:
        True if there are stale worktrees
    """
    stale = check_stale_worktrees(project_dir, stale_days)
    if not stale:
        return False

    print()
    print(warning(f"⚠️  Found {len(stale)} stale worktree(s) (no activity for {stale_days}+ days):"))
    for wt in stale[:5]:  # Show max 5
        print(f"  • {wt['spec_name']} ({wt['days_since_activity']} days)")
    if len(stale) > 5:
        print(f"  ... and {len(stale) - 5} more")
    print()
    print(f"  To clean up: {python_cmd()} auto-codex/run.py --cleanup-worktrees")
    print(f"  Or discard individually: {python_cmd()} auto-codex/run.py --spec <name> --discard")
    print()
    return True


def show_build_summary(manager: WorktreeManager, spec_name: str) -> None:
    """Show a summary of what was built."""
    summary = manager.get_change_summary(spec_name)
    files = manager.get_changed_files(spec_name)

    total = summary["new_files"] + summary["modified_files"] + summary["deleted_files"]

    if total == 0:
        print_status("No changes were made.", "info")
        return

    print()
    print(bold("What was built:"))
    if summary["new_files"] > 0:
        print(
            success(
                f"  + {summary['new_files']} new file{'s' if summary['new_files'] != 1 else ''}"
            )
        )
    if summary["modified_files"] > 0:
        print(
            info(
                f"  ~ {summary['modified_files']} modified file{'s' if summary['modified_files'] != 1 else ''}"
            )
        )
    if summary["deleted_files"] > 0:
        print(
            error(
                f"  - {summary['deleted_files']} deleted file{'s' if summary['deleted_files'] != 1 else ''}"
            )
        )


def show_changed_files(manager: WorktreeManager, spec_name: str) -> None:
    """Show detailed list of changed files."""
    files = manager.get_changed_files(spec_name)

    if not files:
        print_status("No changes.", "info")
        return

    print()
    print(bold("Changed files:"))
    for status, filepath in files:
        if status == "A":
            print(success(f"  + {filepath}"))
        elif status == "M":
            print(info(f"  ~ {filepath}"))
        elif status == "D":
            print(error(f"  - {filepath}"))
        else:
            print(f"  {status} {filepath}")


def print_merge_success(
    no_commit: bool,
    stats: dict | None = None,
    spec_name: str | None = None,
    keep_worktree: bool = False,
) -> None:
    """Print a success message after merge."""
    from ui import Icons, box, icon

    if no_commit:
        lines = [
            success(f"{icon(Icons.SUCCESS)} CHANGES ADDED TO YOUR PROJECT"),
            "",
            "The new code is in your working directory.",
            "Review the changes, then commit when ready.",
        ]

        # Add note about lock files if any were excluded
        if stats and stats.get("lock_files_excluded", 0) > 0:
            lines.append("")
            lines.append("Note: Lock files kept from main.")
            lines.append("Regenerate: npm install / pip install / cargo update")

        # Add worktree cleanup instructions
        if keep_worktree and spec_name:
            lines.append("")
            lines.append("Worktree kept for testing. Delete when satisfied:")
            lines.append(f"  {python_cmd()} auto-codex/run.py --spec {spec_name} --discard")

        content = lines
    else:
        lines = [
            success(f"{icon(Icons.SUCCESS)} FEATURE ADDED TO YOUR PROJECT!"),
            "",
        ]

        if stats:
            lines.append("What changed:")
            if stats.get("files_added", 0) > 0:
                lines.append(
                    f"  + {stats['files_added']} file{'s' if stats['files_added'] != 1 else ''} added"
                )
            if stats.get("files_modified", 0) > 0:
                lines.append(
                    f"  ~ {stats['files_modified']} file{'s' if stats['files_modified'] != 1 else ''} modified"
                )
            if stats.get("files_deleted", 0) > 0:
                lines.append(
                    f"  - {stats['files_deleted']} file{'s' if stats['files_deleted'] != 1 else ''} deleted"
                )
            lines.append("")

        if keep_worktree:
            lines.extend(
                [
                    "Your new feature is now part of your project.",
                    "",
                    "Worktree kept for testing. Delete when satisfied:",
                ]
            )
            if spec_name:
                lines.append(
                    f"  {python_cmd()} auto-codex/run.py --spec {spec_name} --discard"
                )
        else:
            lines.extend(
                [
                    "Your new feature is now part of your project.",
                    "The separate workspace has been cleaned up.",
                ]
            )
        content = lines

    print()
    print(box(content, width=60, style="heavy"))
    print()


def print_conflict_info(result: dict) -> None:
    """Print information about conflicts that occurred during merge."""
    from ui import highlight, muted, warning

    conflicts = result.get("conflicts", [])
    if not conflicts:
        return

    print()
    print(
        warning(
            f"  {len(conflicts)} file{'s' if len(conflicts) != 1 else ''} had conflicts:"
        )
    )
    for conflict_file in conflicts:
        print(f"    {highlight(conflict_file)}")
    print()
    print(muted("  These files have conflict markers (<<<<<<< =======  >>>>>>>)"))
    print(muted("  Review and resolve them, then run:"))
    print(f"    git add {' '.join(conflicts)}")
    print("    git commit")
    print()


# Export private names for backward compatibility
_print_merge_success = print_merge_success
_print_conflict_info = print_conflict_info
