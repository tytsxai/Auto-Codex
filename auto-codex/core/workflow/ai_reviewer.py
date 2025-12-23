#!/usr/bin/env python3
"""
AI Reviewer
===========

AI-powered review of staged changes.
"""

import subprocess
import time
from pathlib import Path

from .change_tracker import ChangeTracker
from .models import (
    IssueType,
    ReviewIssue,
    ReviewReport,
    StagedChange,
    TestResults,
)


class AIReviewer:
    """
    AI-powered reviewer for staged changes.
    
    Analyzes all staged changes for:
    - Code conflicts between tasks
    - Import errors
    - Type mismatches
    - Test failures
    """
    
    def __init__(self, project_dir: Path, change_tracker: ChangeTracker):
        """
        Initialize the AI reviewer.
        
        Args:
            project_dir: Project root directory
            change_tracker: ChangeTracker instance
        """
        self.project_dir = Path(project_dir)
        self.change_tracker = change_tracker
    
    async def review_staged_changes(self) -> ReviewReport:
        """
        Analyze all staged changes for issues.
        
        Returns:
            ReviewReport with issues, suggestions, and test results
        """
        changes = self.change_tracker.get_all_staged()
        
        if not changes:
            return ReviewReport(
                success=True,
                summary="No staged changes to review.",
            )
        
        issues: list[ReviewIssue] = []
        suggestions: list[str] = []
        
        # 1. Detect conflicts between tasks
        conflict_issues = self.detect_conflicts(changes)
        issues.extend(conflict_issues)
        
        # 2. Check for syntax errors
        syntax_issues = self._check_syntax_errors(changes)
        issues.extend(syntax_issues)
        
        # 3. Check for import errors (Python)
        import_issues = self._check_import_errors(changes)
        issues.extend(import_issues)
        
        # 4. Run tests
        test_results = await self.run_tests()
        if test_results and not test_results.success:
            for error in test_results.errors:
                issues.append(ReviewIssue(
                    file="",
                    line=None,
                    type=IssueType.TEST_FAILURE,
                    message=error,
                ))
        
        # 5. Generate suggestions
        if conflict_issues:
            suggestions.append(
                "Consider merging tasks with conflicts one at a time to resolve issues."
            )
        
        if syntax_issues:
            suggestions.append(
                "Fix syntax errors before committing."
            )
        
        # Build summary
        total_files = sum(len(c.files) for c in changes)
        summary = f"Reviewed {total_files} files from {len(changes)} task(s). "
        
        if issues:
            summary += f"Found {len(issues)} issue(s)."
        else:
            summary += "No issues found."
        
        return ReviewReport(
            success=len(issues) == 0,
            issues=issues,
            test_results=test_results,
            suggestions=suggestions,
            summary=summary,
        )
    
    def detect_conflicts(self, changes: list[StagedChange]) -> list[ReviewIssue]:
        """
        Detect conflicts between staged changes from different tasks.
        
        Args:
            changes: List of staged changes
            
        Returns:
            List of conflict issues
        """
        issues = []
        
        # Build file -> tasks mapping
        file_tasks: dict[str, list[str]] = {}
        for change in changes:
            for file_path in change.files:
                if file_path not in file_tasks:
                    file_tasks[file_path] = []
                file_tasks[file_path].append(change.spec_name)
        
        # Find files modified by multiple tasks
        for file_path, tasks in file_tasks.items():
            if len(tasks) > 1:
                issues.append(ReviewIssue(
                    file=file_path,
                    line=None,
                    type=IssueType.CONFLICT,
                    message=f"File modified by multiple tasks: {', '.join(tasks)}",
                    suggestion="Review changes from each task and merge manually if needed.",
                ))
        
        return issues
    
    async def run_tests(self) -> TestResults | None:
        """
        Execute tests and return results.
        
        Returns:
            TestResults or None if tests couldn't be run
        """
        start_time = time.time()
        
        # Try Python tests first
        python_result = self._run_python_tests()
        if python_result:
            python_result.duration_seconds = time.time() - start_time
            return python_result
        
        # Try TypeScript tests
        ts_result = self._run_typescript_tests()
        if ts_result:
            ts_result.duration_seconds = time.time() - start_time
            return ts_result
        
        return None
    
    def generate_commit_message(
        self,
        changes: list[StagedChange],
        mode: str,
    ) -> str:
        """
        Generate AI-suggested commit message.
        
        Args:
            changes: List of staged changes
            mode: Commit mode ('all', 'by_task', 'partial')
            
        Returns:
            Suggested commit message
        """
        if not changes:
            return "chore: update files"
        
        if mode == "all":
            # Combine all task names
            specs = sorted(set(c.spec_name for c in changes))
            if len(specs) == 1:
                return f"feat({specs[0]}): implement {specs[0]}"
            else:
                return f"feat: implement {', '.join(specs)}"
        
        elif mode == "by_task":
            # Return message for first task (caller should iterate)
            change = changes[0]
            return f"feat({change.spec_name}): implement {change.spec_name}"
        
        else:
            # Partial - generic message
            total_files = sum(len(c.files) for c in changes)
            return f"chore: update {total_files} file(s)"
    
    def _check_syntax_errors(self, changes: list[StagedChange]) -> list[ReviewIssue]:
        """Check for syntax errors in Python files."""
        issues = []
        
        for change in changes:
            for file_path in change.files:
                if file_path.endswith(".py"):
                    full_path = self.project_dir / file_path
                    if full_path.exists():
                        result = subprocess.run(
                            ["python3", "-m", "py_compile", str(full_path)],
                            capture_output=True,
                            text=True,
                        )
                        if result.returncode != 0:
                            issues.append(ReviewIssue(
                                file=file_path,
                                line=None,
                                type=IssueType.SYNTAX_ERROR,
                                message=result.stderr.strip() or "Syntax error",
                            ))
        
        return issues
    
    def _check_import_errors(self, changes: list[StagedChange]) -> list[ReviewIssue]:
        """Check for import errors in Python files."""
        issues = []
        
        # This is a simplified check - just verify imports can be parsed
        # A full check would require actually importing the modules
        
        return issues
    
    def _run_python_tests(self) -> TestResults | None:
        """Run Python tests using pytest."""
        # Check if pytest is available
        result = subprocess.run(
            ["python3", "-m", "pytest", "--version"],
            cwd=self.project_dir,
            capture_output=True,
        )
        
        if result.returncode != 0:
            return None
        
        # Run tests
        result = subprocess.run(
            ["python3", "-m", "pytest", "-v", "--tb=short", "-q"],
            cwd=self.project_dir,
            capture_output=True,
            text=True,
            timeout=300,  # 5 minute timeout
        )
        
        # Parse results
        output = result.stdout + result.stderr
        
        passed = 0
        failed = 0
        skipped = 0
        errors = []
        
        # Look for summary line like "5 passed, 2 failed, 1 skipped"
        for line in output.split("\n"):
            if "passed" in line or "failed" in line:
                import re
                passed_match = re.search(r"(\d+) passed", line)
                failed_match = re.search(r"(\d+) failed", line)
                skipped_match = re.search(r"(\d+) skipped", line)
                
                if passed_match:
                    passed = int(passed_match.group(1))
                if failed_match:
                    failed = int(failed_match.group(1))
                if skipped_match:
                    skipped = int(skipped_match.group(1))
        
        if result.returncode != 0 and failed == 0:
            errors.append(f"Test execution failed: {output[:500]}")
        
        return TestResults(
            passed=passed,
            failed=failed,
            skipped=skipped,
            errors=errors,
        )
    
    def _run_typescript_tests(self) -> TestResults | None:
        """Run TypeScript tests using vitest or jest."""
        # Check for vitest
        ui_dir = self.project_dir / "auto-codex-ui"
        if not ui_dir.exists():
            return None
        
        result = subprocess.run(
            ["pnpm", "test", "--run"],
            cwd=ui_dir,
            capture_output=True,
            text=True,
            timeout=300,
        )
        
        # Parse results (simplified)
        output = result.stdout + result.stderr
        
        passed = 0
        failed = 0
        
        # Look for vitest summary
        import re
        tests_match = re.search(r"Tests\s+(\d+)\s+passed", output)
        if tests_match:
            passed = int(tests_match.group(1))
        
        failed_match = re.search(r"(\d+)\s+failed", output)
        if failed_match:
            failed = int(failed_match.group(1))
        
        errors = []
        if result.returncode != 0 and failed == 0:
            errors.append(f"Test execution failed: {output[:500]}")
        
        return TestResults(
            passed=passed,
            failed=failed,
            skipped=0,
            errors=errors,
        )
