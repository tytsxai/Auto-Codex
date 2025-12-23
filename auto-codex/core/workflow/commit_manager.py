#!/usr/bin/env python3
"""
Commit Manager
==============

Handles various commit modes for staged changes.
"""

import subprocess
from pathlib import Path

from .change_tracker import ChangeTracker
from .models import CommitResult, StagedChange


class CommitManager:
    """
    Manages commit operations for staged changes.
    
    Supports:
    - commit_all: Single commit with all staged changes
    - commit_by_task: Separate commits for each task
    - commit_partial: Commit only selected files
    - discard_all: Unstage all changes
    """
    
    def __init__(self, project_dir: Path, change_tracker: ChangeTracker):
        """
        Initialize the commit manager.
        
        Args:
            project_dir: Project root directory
            change_tracker: ChangeTracker instance
        """
        self.project_dir = Path(project_dir)
        self.change_tracker = change_tracker
    
    def commit_all(self, message: str) -> CommitResult:
        """
        Create single commit with all staged changes.
        
        Args:
            message: Commit message
            
        Returns:
            CommitResult with commit hash
        """
        # Get all staged files
        all_files = self.change_tracker.get_all_files()
        if not all_files:
            return CommitResult(
                success=False,
                error="No staged changes to commit",
            )
        
        # Verify files are staged in git
        staged_in_git = self._get_git_staged_files()
        if not staged_in_git:
            return CommitResult(
                success=False,
                error="No files staged in git",
            )
        
        # Commit
        result = subprocess.run(
            ["git", "commit", "-m", message],
            cwd=self.project_dir,
            capture_output=True,
            text=True,
        )
        
        if result.returncode != 0:
            return CommitResult(
                success=False,
                error=f"Commit failed: {result.stderr}",
            )
        
        # Get commit hash
        hash_result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=self.project_dir,
            capture_output=True,
            text=True,
        )
        commit_hash = hash_result.stdout.strip() if hash_result.returncode == 0 else None
        
        # Clear change tracker
        self.change_tracker.clear_all()
        
        return CommitResult(
            success=True,
            commit_hash=commit_hash,
            message=message,
            files_committed=all_files,
        )
    
    def commit_by_task(
        self,
        messages: dict[str, str] | None = None,
    ) -> list[CommitResult]:
        """
        Create separate commits for each task.
        
        Args:
            messages: Dict of task_id -> commit message (optional)
            
        Returns:
            List of CommitResult for each task
        """
        results = []
        changes = self.change_tracker.get_all_staged()
        
        if not changes:
            return [CommitResult(
                success=False,
                error="No staged changes to commit",
            )]
        
        for change in changes:
            # Get message for this task
            message = (
                messages.get(change.task_id) if messages
                else f"feat({change.spec_name}): implement {change.spec_name}"
            )
            
            # Reset staging area
            subprocess.run(
                ["git", "reset", "HEAD"],
                cwd=self.project_dir,
                capture_output=True,
            )
            
            # Stage only this task's files
            for file_path in change.files:
                subprocess.run(
                    ["git", "add", file_path],
                    cwd=self.project_dir,
                    capture_output=True,
                )
            
            # Commit
            result = subprocess.run(
                ["git", "commit", "-m", message],
                cwd=self.project_dir,
                capture_output=True,
                text=True,
            )
            
            if result.returncode != 0:
                results.append(CommitResult(
                    success=False,
                    message=message,
                    files_committed=change.files,
                    error=f"Commit failed: {result.stderr}",
                ))
                continue
            
            # Get commit hash
            hash_result = subprocess.run(
                ["git", "rev-parse", "HEAD"],
                cwd=self.project_dir,
                capture_output=True,
                text=True,
            )
            commit_hash = hash_result.stdout.strip() if hash_result.returncode == 0 else None
            
            # Remove from tracker
            self.change_tracker.remove_changes(change.task_id)
            
            results.append(CommitResult(
                success=True,
                commit_hash=commit_hash,
                message=message,
                files_committed=change.files,
            ))
        
        return results
    
    def commit_partial(self, files: list[str], message: str) -> CommitResult:
        """
        Commit only selected files.
        
        Args:
            files: List of file paths to commit
            message: Commit message
            
        Returns:
            CommitResult
        """
        if not files:
            return CommitResult(
                success=False,
                error="No files specified",
            )
        
        # Reset staging area
        subprocess.run(
            ["git", "reset", "HEAD"],
            cwd=self.project_dir,
            capture_output=True,
        )
        
        # Stage only selected files
        for file_path in files:
            subprocess.run(
                ["git", "add", file_path],
                cwd=self.project_dir,
                capture_output=True,
            )
        
        # Commit
        result = subprocess.run(
            ["git", "commit", "-m", message],
            cwd=self.project_dir,
            capture_output=True,
            text=True,
        )
        
        if result.returncode != 0:
            return CommitResult(
                success=False,
                error=f"Commit failed: {result.stderr}",
            )
        
        # Get commit hash
        hash_result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=self.project_dir,
            capture_output=True,
            text=True,
        )
        commit_hash = hash_result.stdout.strip() if hash_result.returncode == 0 else None
        
        # Update change tracker - remove committed files from each task
        committed_set = set(files)
        for change in self.change_tracker.get_all_staged():
            remaining = [f for f in change.files if f not in committed_set]
            if remaining:
                # Update with remaining files
                self.change_tracker.track_changes(
                    task_id=change.task_id,
                    spec_name=change.spec_name,
                    files=remaining,
                    merge_source=change.merge_source,
                )
            else:
                # All files committed, remove task
                self.change_tracker.remove_changes(change.task_id)
        
        # Re-stage remaining files
        for change in self.change_tracker.get_all_staged():
            for file_path in change.files:
                subprocess.run(
                    ["git", "add", file_path],
                    cwd=self.project_dir,
                    capture_output=True,
                )
        
        return CommitResult(
            success=True,
            commit_hash=commit_hash,
            message=message,
            files_committed=files,
        )
    
    def discard_all(self, restore_worktrees: bool = False) -> bool:
        """
        Unstage all changes.
        
        Args:
            restore_worktrees: If True, restore worktrees from merge_source
            
        Returns:
            True if successful
        """
        # Get all staged files
        all_files = self.change_tracker.get_all_files()
        
        # Reset staging area
        subprocess.run(
            ["git", "reset", "HEAD"],
            cwd=self.project_dir,
            capture_output=True,
        )
        
        # Restore files to their original state
        for file_path in all_files:
            subprocess.run(
                ["git", "checkout", "--", file_path],
                cwd=self.project_dir,
                capture_output=True,
            )
        
        # Clear change tracker
        self.change_tracker.clear_all()
        
        return True
    
    def _get_git_staged_files(self) -> list[str]:
        """Get list of files currently staged in git."""
        result = subprocess.run(
            ["git", "diff", "--staged", "--name-only"],
            cwd=self.project_dir,
            capture_output=True,
            text=True,
        )
        
        if result.returncode != 0:
            return []
        
        return [f.strip() for f in result.stdout.strip().split("\n") if f.strip()]
