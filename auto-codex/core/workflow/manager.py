#!/usr/bin/env python3
"""
Workflow Manager
================

Manages worktree lifecycle: staging, cleanup, health monitoring.
"""

import os
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from .change_tracker import ChangeTracker
from .models import (
    ConflictRisk,
    RiskLevel,
    StageResult,
    WorkflowSettings,
    WorktreeHealthStatus,
    WorktreeInfo,
)


class WorkflowManager:
    """
    Manages the smart worktree workflow.
    
    Handles:
    - Staging worktree changes to main repository
    - Auto-cleanup after successful staging
    - Health monitoring (count, disk usage, stale detection)
    - Conflict risk analysis between worktrees
    """
    
    def __init__(
        self,
        project_dir: Path,
        settings: WorkflowSettings | None = None,
    ):
        """
        Initialize the workflow manager.
        
        Args:
            project_dir: Project root directory
            settings: Workflow settings (uses defaults if None)
        """
        self.project_dir = Path(project_dir)
        self.settings = settings or WorkflowSettings()
        self.change_tracker = ChangeTracker(project_dir)
        self.worktrees_dir = self.project_dir / ".worktrees"
        self.base_branch = self._detect_base_branch()
    
    def stage_worktree(
        self,
        spec_name: str,
        task_id: str | None = None,
        auto_cleanup: bool | None = None,
    ) -> StageResult:
        """
        Stage worktree changes to main repository without committing.
        
        Args:
            spec_name: Name of the spec/worktree
            task_id: Task identifier (defaults to spec_name)
            auto_cleanup: Override settings.auto_cleanup_after_merge
        
        Returns:
            StageResult with success status and staged files
        """
        task_id = task_id or spec_name
        should_cleanup = (
            auto_cleanup if auto_cleanup is not None
            else self.settings.auto_cleanup_after_merge
        )
        
        worktree_path = self.worktrees_dir / spec_name
        if not worktree_path.exists():
            return StageResult(
                success=False,
                error=f"Worktree not found: {spec_name}",
            )
        
        try:
            # Get the worktree branch
            branch = self._get_worktree_branch(worktree_path)
            
            # Get changed files from worktree (committed + uncommitted)
            committed_files = self._get_changed_files(worktree_path, branch)
            status_files, status_deleted = self._get_status_changes(worktree_path)
            files = sorted(set(committed_files) | status_files | status_deleted)
            if not files:
                return StageResult(
                    success=True,
                    files_staged=[],
                    worktree_cleaned=False,
                    error="No changes to stage",
                )
            
            # Stage changes using files from worktree working tree
            staged_files = self._stage_files_from_worktree(worktree_path, files)
            
            # Track the changes
            self.change_tracker.track_changes(
                task_id=task_id,
                spec_name=spec_name,
                files=staged_files,
                merge_source=str(worktree_path),
            )
            
            # Auto-cleanup if enabled
            worktree_cleaned = False
            if should_cleanup and staged_files:
                try:
                    self.cleanup_worktree(spec_name)
                    worktree_cleaned = True
                except Exception as e:
                    # Log but don't fail the staging
                    print(f"Warning: Failed to cleanup worktree: {e}")
            
            return StageResult(
                success=True,
                files_staged=staged_files,
                worktree_cleaned=worktree_cleaned,
            )
            
        except Exception as e:
            return StageResult(
                success=False,
                error=str(e),
            )
    
    def cleanup_worktree(self, spec_name: str) -> bool:
        """
        Delete a worktree and its branch.
        
        Args:
            spec_name: Name of the spec/worktree
            
        Returns:
            True if cleanup succeeded
        """
        worktree_path = self.worktrees_dir / spec_name
        if not worktree_path.exists():
            return True  # Already cleaned
        
        # Get branch name before removing
        branch = self._get_worktree_branch(worktree_path)
        
        # Remove worktree
        result = subprocess.run(
            ["git", "worktree", "remove", "--force", str(worktree_path)],
            cwd=self.project_dir,
            capture_output=True,
            text=True,
        )
        
        if result.returncode != 0:
            raise RuntimeError(f"Failed to remove worktree: {result.stderr}")
        
        # Delete branch
        subprocess.run(
            ["git", "branch", "-D", branch],
            cwd=self.project_dir,
            capture_output=True,
            text=True,
        )
        
        # Remove from change tracker
        self.change_tracker.remove_changes_by_spec(spec_name)
        
        return True
    
    def cleanup_stale_worktrees(self, days: int | None = None) -> list[str]:
        """
        Remove all worktrees older than N days.
        
        Args:
            days: Days threshold (uses settings if None)
            
        Returns:
            List of cleaned up spec names
        """
        days = days if days is not None else self.settings.stale_worktree_days
        cleaned = []
        
        for worktree in self._list_worktrees():
            if worktree.days_since_activity >= days:
                try:
                    self.cleanup_worktree(worktree.spec_name)
                    cleaned.append(worktree.spec_name)
                except Exception as e:
                    print(f"Warning: Failed to cleanup {worktree.spec_name}: {e}")
        
        return cleaned
    
    def get_health_status(self) -> WorktreeHealthStatus:
        """
        Get overall worktree health metrics.
        
        Returns:
            WorktreeHealthStatus with counts and disk usage
        """
        worktrees = self._list_worktrees()
        
        total_count = len(worktrees)
        stale_count = sum(
            1 for w in worktrees
            if w.days_since_activity >= self.settings.stale_worktree_days
        )
        total_disk_usage = sum(w.disk_usage_mb for w in worktrees)
        
        # Generate warning if needed
        warning = None
        if total_count >= self.settings.max_worktrees_warning:
            warning = f"You have {total_count} worktrees. Consider cleaning up stale ones."
        
        return WorktreeHealthStatus(
            total_count=total_count,
            stale_count=stale_count,
            total_disk_usage_mb=total_disk_usage,
            worktrees=worktrees,
            warning_message=warning,
        )
    
    def get_conflict_risks(self) -> list[ConflictRisk]:
        """
        Analyze potential conflicts between worktrees.
        
        Returns:
            List of ConflictRisk objects
        """
        worktrees = self._list_worktrees()
        risks = []
        
        # Get changed files for each worktree
        worktree_files: dict[str, set[str]] = {}
        for wt in worktrees:
            worktree_path = self.worktrees_dir / wt.spec_name
            branch = self._get_worktree_branch(worktree_path)
            files = self._get_changed_files(worktree_path, branch)
            worktree_files[wt.spec_name] = set(files)
        
        # Compare each pair
        specs = list(worktree_files.keys())
        for i, spec_a in enumerate(specs):
            for spec_b in specs[i + 1:]:
                common = worktree_files[spec_a] & worktree_files[spec_b]
                if common:
                    # Determine risk level
                    if len(common) > 5:
                        level = RiskLevel.HIGH
                    elif len(common) > 2:
                        level = RiskLevel.MEDIUM
                    else:
                        level = RiskLevel.LOW
                    
                    risks.append(ConflictRisk(
                        worktree_a=spec_a,
                        worktree_b=spec_b,
                        conflicting_files=sorted(common),
                        risk_level=level,
                    ))
        
        return risks

    def get_worktree_changes(self, spec_name: str) -> dict:
        """
        Get current git changes in a worktree without staging.
        
        Args:
            spec_name: Name of the spec/worktree
            
        Returns:
            Dictionary with files and file_count
        """
        worktree_path = self.worktrees_dir / spec_name
        if not worktree_path.exists():
            return {"spec_name": spec_name, "files": [], "file_count": 0, "staged": False}
        
        try:
            status_files, deleted_files = self._get_status_changes(worktree_path)
            all_files = sorted(status_files | deleted_files)
            return {
                "spec_name": spec_name,
                "files": all_files,
                "file_count": len(all_files),
                "staged": False,
            }
        except Exception:
            return {"spec_name": spec_name, "files": [], "file_count": 0, "staged": False}

    def get_all_worktree_changes(self) -> list[dict]:
        """
        Get git changes from all worktrees.
        
        Returns:
            List of change dictionaries for each worktree with changes
        """
        changes = []
        worktrees = self._list_worktrees()
        
        for wt in worktrees:
            wt_changes = self.get_worktree_changes(wt.spec_name)
            if wt_changes["file_count"] > 0:
                changes.append(wt_changes)
        
        return changes
    
    def suggest_merge_order(self) -> list[str]:
        """
        Suggest optimal merge order based on conflict analysis.
        
        Strategy:
        1. Worktrees with no conflicts first
        2. Then by number of conflicting files (fewer first)
        3. Then by age (older first)
        
        Returns:
            List of spec names in suggested order
        """
        worktrees = self._list_worktrees()
        risks = self.get_conflict_risks()
        
        # Count conflicts per worktree
        conflict_count: dict[str, int] = {w.spec_name: 0 for w in worktrees}
        for risk in risks:
            conflict_count[risk.worktree_a] += len(risk.conflicting_files)
            conflict_count[risk.worktree_b] += len(risk.conflicting_files)
        
        # Sort by: conflict count, then age
        def sort_key(wt: WorktreeInfo) -> tuple[int, int]:
            return (conflict_count[wt.spec_name], -wt.days_since_activity)
        
        sorted_worktrees = sorted(worktrees, key=sort_key)
        return [w.spec_name for w in sorted_worktrees]
    
    # Private helper methods
    
    def _list_worktrees(self) -> list[WorktreeInfo]:
        """List all worktrees with their info."""
        worktrees = []
        
        if not self.worktrees_dir.exists():
            return worktrees
        
        for entry in self.worktrees_dir.iterdir():
            if not entry.is_dir() or entry.name.startswith("worker-"):
                continue
            
            try:
                branch = self._get_worktree_branch(entry)
                days = self._get_days_since_activity(entry)
                disk_mb = self._get_disk_usage_mb(entry)
                stats = self._get_worktree_stats(entry)
                
                worktrees.append(WorktreeInfo(
                    spec_name=entry.name,
                    path=str(entry),
                    branch=branch,
                    days_since_activity=days,
                    disk_usage_mb=disk_mb,
                    base_branch=stats["base_branch"],
                    commit_count=stats["commit_count"],
                    files_changed=stats["files_changed"],
                    additions=stats["additions"],
                    deletions=stats["deletions"],
                    last_commit_date=stats["last_commit_date"],
                    is_stale=stats["is_stale"]
                ))
            except Exception:
                continue
        
        return worktrees

    def _get_worktree_stats(self, worktree_path: Path) -> dict[str, Any]:
        """Get git statistics for a worktree."""
        stats = {
            "files_changed": 0,
            "additions": 0,
            "deletions": 0,
            "commit_count": 0,
            "base_branch": "main",
            "last_commit_date": None,
            "is_stale": False,
        }
        
        if not worktree_path.exists():
            return stats
            
        try:
            # Get changes (modified files + line changes)
            # Use git diff --numstat for line changes (vs HEAD to include both staged and unstaged)
            result = subprocess.run(
                ['git', 'diff', '--numstat', 'HEAD'],
                cwd=worktree_path,
                capture_output=True,
                text=True,
                check=False
            )
            
            additions = 0
            deletions = 0
            
            for line in result.stdout.splitlines():
                parts = line.split('\t')
                if len(parts) >= 3:
                    try:
                        add = int(parts[0]) if parts[0] != '-' else 0
                        delete = int(parts[1]) if parts[1] != '-' else 0
                        additions += add
                        deletions += delete
                    except ValueError:
                        continue
            
            # Use porcelain for file count (includes untracked)
            status_result = subprocess.run(
                 ['git', 'status', '--porcelain'],
                 cwd=worktree_path,
                 capture_output=True,
                 text=True,
                 check=False
            )
            stats["files_changed"] = len(status_result.stdout.splitlines())
            stats["additions"] = additions
            stats["deletions"] = deletions

            # Get commit count ahead of base branch (main)
            base_branch = "main"
            
            commit_res = subprocess.run(
                ['git', 'rev-list', '--count', 'HEAD', f'^{base_branch}'],
                cwd=worktree_path,
                capture_output=True,
                text=True,
                check=False
            )
            if commit_res.returncode == 0:
                try:
                    stats["commit_count"] = int(commit_res.stdout.strip())
                except ValueError:
                    pass
                    
            # Get last commit date
            date_res = subprocess.run(
                ['git', 'log', '-1', '--format=%cI'],
                cwd=worktree_path,
                capture_output=True,
                text=True,
                check=False
            )
            if date_res.returncode == 0:
                stats["last_commit_date"] = date_res.stdout.strip()

            # Staleness is already calculated via disk activity, keeping is_stale consistent with days
            
            return stats
            
        except Exception:
            return stats
    
    def _get_worktree_branch(self, worktree_path: Path) -> str:
        """Get the branch name for a worktree."""
        result = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            cwd=worktree_path,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            raise RuntimeError(f"Failed to get branch: {result.stderr}")
        return result.stdout.strip()
    
    def _get_changed_files(self, worktree_path: Path, branch: str) -> list[str]:
        """Get list of changed files in worktree compared to main."""
        main_branch = self.base_branch
        if not main_branch:
            main_branch = self._get_current_branch() or "main"
        
        # Get diff
        result = subprocess.run(
            ["git", "diff", "--name-only", f"{main_branch}...HEAD"],
            cwd=worktree_path,
            capture_output=True,
            text=True,
        )
        
        if result.returncode != 0:
            # Fallback to two-arg diff
            result = subprocess.run(
                ["git", "diff", "--name-only", main_branch, "HEAD"],
                cwd=worktree_path,
                capture_output=True,
                text=True,
            )
        
        if result.returncode != 0:
            return []
        
        return [f.strip() for f in result.stdout.strip().split("\n") if f.strip()]
    
    def _stage_files_from_worktree(
        self, worktree_path: Path, files: list[str]
    ) -> list[str]:
        """Stage files from a worktree into the main working directory."""
        staged = []
        
        for file_path in files:
            if self._is_ignored_path(file_path):
                continue

            source = worktree_path / file_path
            target = self.project_dir / file_path

            if source.exists():
                if target.exists() and target.is_dir() and source.is_file():
                    shutil.rmtree(target)
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, target, follow_symlinks=False)
                subprocess.run(
                    ["git", "add", file_path],
                    cwd=self.project_dir,
                    capture_output=True,
                )
                staged.append(file_path)
            else:
                # File was deleted in worktree
                if target.exists():
                    if target.is_dir():
                        shutil.rmtree(target)
                    else:
                        target.unlink()
                subprocess.run(
                    ["git", "add", file_path],
                    cwd=self.project_dir,
                    capture_output=True,
                )
                staged.append(file_path)
        
        return staged

    def _detect_base_branch(self) -> str:
        """Detect the base branch for diffs and staging."""
        env_branch = os.getenv("DEFAULT_BRANCH")
        if env_branch and self._branch_exists(env_branch):
            return env_branch

        origin_head = self._get_origin_head()
        if origin_head and self._branch_exists(origin_head):
            return origin_head

        for branch in ("main", "master"):
            if self._branch_exists(branch):
                return branch

        current = self._get_current_branch()
        return current or "main"

    def _branch_exists(self, branch: str) -> bool:
        result = subprocess.run(
            ["git", "rev-parse", "--verify", branch],
            cwd=self.project_dir,
            capture_output=True,
            text=True,
        )
        return result.returncode == 0

    def _get_origin_head(self) -> str | None:
        result = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "origin/HEAD"],
            cwd=self.project_dir,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            return None
        value = result.stdout.strip()
        if value.startswith("origin/"):
            return value.replace("origin/", "", 1)
        return value or None

    def _get_current_branch(self) -> str | None:
        result = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            cwd=self.project_dir,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            return None
        return result.stdout.strip()
    
    def _get_days_since_activity(self, worktree_path: Path) -> int:
        """Get days since last commit in worktree."""
        result = subprocess.run(
            ["git", "log", "-1", "--format=%cI"],
            cwd=worktree_path,
            capture_output=True,
            text=True,
        )
        
        if result.returncode != 0 or not result.stdout.strip():
            return 0
        
        try:
            last_commit = datetime.fromisoformat(
                result.stdout.strip().replace("Z", "+00:00")
            )
            now = datetime.now(timezone.utc)
            return (now - last_commit).days
        except Exception:
            return 0
    
    def _get_disk_usage_mb(self, path: Path) -> float:
        """Get disk usage of a directory in MB."""
        total = 0
        try:
            for dirpath, dirnames, filenames in os.walk(path):
                for f in filenames:
                    fp = os.path.join(dirpath, f)
                    try:
                        total += os.path.getsize(fp)
                    except OSError:
                        pass
        except Exception:
            pass
        return total / (1024 * 1024)

    def _get_status_changes(self, worktree_path: Path) -> tuple[set[str], set[str]]:
        """Get changed and deleted files from worktree status."""
        result = subprocess.run(
            ["git", "status", "--porcelain"],
            cwd=worktree_path,
            capture_output=True,
            text=True,
        )

        changed: set[str] = set()
        deleted: set[str] = set()

        if result.returncode != 0:
            return changed, deleted

        for line in result.stdout.splitlines():
            if not line:
                continue
            status = line[:2]
            path = line[3:].strip()
            if not path:
                continue
            if " -> " in path:
                old_path, new_path = [p.strip() for p in path.split(" -> ", 1)]
                if old_path:
                    deleted.add(old_path)
                if new_path:
                    changed.add(new_path)
                continue
            if "D" in status:
                deleted.add(path)
                continue
            changed.add(path)

        return changed, deleted

    def _is_ignored_path(self, file_path: str) -> bool:
        ignored_prefixes = (".auto-codex/", ".worktrees/", ".git/")
        if file_path.startswith(ignored_prefixes):
            return True
        return False
