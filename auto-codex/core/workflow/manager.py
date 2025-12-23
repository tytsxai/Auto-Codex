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
            
            # Get changed files from worktree
            files = self._get_changed_files(worktree_path, branch)
            if not files:
                return StageResult(
                    success=True,
                    files_staged=[],
                    worktree_cleaned=False,
                    error="No changes to stage",
                )
            
            # Stage changes using git checkout from worktree branch
            staged_files = self._stage_files_from_branch(branch, files)
            
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
                
                worktrees.append(WorktreeInfo(
                    spec_name=entry.name,
                    path=str(entry),
                    branch=branch,
                    days_since_activity=days,
                    disk_usage_mb=disk_mb,
                ))
            except Exception:
                continue
        
        return worktrees
    
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
        # Get current branch in main project
        main_branch_result = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            cwd=self.project_dir,
            capture_output=True,
            text=True,
        )
        main_branch = main_branch_result.stdout.strip() if main_branch_result.returncode == 0 else "main"
        
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
    
    def _stage_files_from_branch(self, branch: str, files: list[str]) -> list[str]:
        """Stage files from a branch into the main working directory."""
        staged = []
        
        for file_path in files:
            # Get file content from branch
            result = subprocess.run(
                ["git", "show", f"{branch}:{file_path}"],
                cwd=self.project_dir,
                capture_output=True,
            )
            
            if result.returncode == 0:
                # Write to working directory
                target = self.project_dir / file_path
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(result.stdout)
                
                # Stage the file
                subprocess.run(
                    ["git", "add", file_path],
                    cwd=self.project_dir,
                    capture_output=True,
                )
                staged.append(file_path)
            elif "does not exist" in result.stderr.decode():
                # File was deleted in branch
                target = self.project_dir / file_path
                if target.exists():
                    target.unlink()
                    subprocess.run(
                        ["git", "add", file_path],
                        cwd=self.project_dir,
                        capture_output=True,
                    )
                    staged.append(file_path)
        
        return staged
    
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
