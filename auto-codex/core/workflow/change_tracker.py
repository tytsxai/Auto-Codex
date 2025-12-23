#!/usr/bin/env python3
"""
Change Tracker
==============

Tracks staged changes and their source tasks.
Persists state to .auto-codex/staged_changes.json.
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Any

from .models import StagedChange, StagedChangesStore


class ChangeTracker:
    """
    Tracks which files belong to which task in staged changes.
    
    Provides persistence to survive app restarts and allows
    grouping changes by source task for flexible commit options.
    """
    
    def __init__(self, project_dir: Path):
        """
        Initialize the change tracker.
        
        Args:
            project_dir: Project root directory
        """
        self.project_dir = Path(project_dir)
        self.store_path = self.project_dir / ".auto-codex" / "staged_changes.json"
        self._store: StagedChangesStore | None = None
    
    @property
    def store(self) -> StagedChangesStore:
        """Get the store, loading from disk if needed."""
        if self._store is None:
            self.restore()
        return self._store
    
    def track_changes(
        self,
        task_id: str,
        spec_name: str,
        files: list[str],
        merge_source: str = "",
    ) -> None:
        """
        Record which files belong to which task.
        
        Args:
            task_id: Unique task identifier
            spec_name: Name of the spec
            files: List of file paths that were staged
            merge_source: Path to the worktree (optional)
        """
        # Remove any existing entry for this task
        self.remove_changes(task_id)
        
        # Add new entry
        change = StagedChange(
            task_id=task_id,
            spec_name=spec_name,
            files=files,
            staged_at=datetime.now(),
            merge_source=merge_source,
        )
        self.store.changes.append(change)
        self.persist()
    
    def get_changes_by_task(self, task_id: str) -> list[str]:
        """
        Get files staged by a specific task.
        
        Args:
            task_id: Task identifier
            
        Returns:
            List of file paths
        """
        for change in self.store.changes:
            if change.task_id == task_id:
                return change.files
        return []
    
    def get_changes_by_spec(self, spec_name: str) -> StagedChange | None:
        """
        Get staged change for a specific spec.
        
        Args:
            spec_name: Spec name
            
        Returns:
            StagedChange or None
        """
        for change in self.store.changes:
            if change.spec_name == spec_name:
                return change
        return None
    
    def get_all_staged(self) -> list[StagedChange]:
        """
        Get all staged changes grouped by task.
        
        Returns:
            List of StagedChange objects
        """
        return list(self.store.changes)
    
    def get_all_files(self) -> list[str]:
        """
        Get all staged files across all tasks.
        
        Returns:
            List of unique file paths
        """
        files = set()
        for change in self.store.changes:
            files.update(change.files)
        return sorted(files)
    
    def remove_changes(self, task_id: str) -> None:
        """
        Remove tracking for a task (after commit/discard).
        
        Args:
            task_id: Task identifier
        """
        self.store.changes = [
            c for c in self.store.changes if c.task_id != task_id
        ]
        self.persist()
    
    def remove_changes_by_spec(self, spec_name: str) -> None:
        """
        Remove tracking for a spec.
        
        Args:
            spec_name: Spec name
        """
        self.store.changes = [
            c for c in self.store.changes if c.spec_name != spec_name
        ]
        self.persist()
    
    def clear_all(self) -> None:
        """Remove all tracked changes."""
        self.store.changes = []
        self.persist()
    
    def has_staged_changes(self) -> bool:
        """Check if there are any staged changes."""
        return len(self.store.changes) > 0
    
    def get_task_count(self) -> int:
        """Get number of tasks with staged changes."""
        return len(self.store.changes)
    
    def persist(self) -> None:
        """Save state to disk."""
        # Ensure directory exists
        self.store_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Write JSON
        with open(self.store_path, "w", encoding="utf-8") as f:
            json.dump(self.store.to_dict(), f, indent=2, ensure_ascii=False)
    
    def restore(self) -> None:
        """Load state from disk."""
        if self.store_path.exists():
            try:
                with open(self.store_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                self._store = StagedChangesStore.from_dict(data)
            except (json.JSONDecodeError, KeyError, TypeError) as e:
                # Corrupted file - reset to empty state
                print(f"Warning: Could not load staged_changes.json: {e}")
                self._store = StagedChangesStore()
        else:
            self._store = StagedChangesStore()
    
    def to_dict(self) -> dict[str, Any]:
        """Convert current state to dictionary."""
        return self.store.to_dict()
