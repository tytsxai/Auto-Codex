"""
QA Loop Controller
==================

Enforces QA validation loop with iteration limits and escalation.
"""

import json
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

MAX_QA_ITERATIONS = 5


@dataclass
class QAResult:
    """Result of a QA validation run."""
    approved: bool
    issues: list[dict[str, Any]]
    iteration: int
    timestamp: str


@dataclass
class QATracking:
    """Tracks QA iteration state."""
    current_iteration: int
    max_iterations: int
    history: list[dict[str, Any]]
    
    @classmethod
    def from_dict(cls, data: dict) -> "QATracking":
        return cls(
            current_iteration=data.get("current_iteration", 0),
            max_iterations=data.get("max_iterations", MAX_QA_ITERATIONS),
            history=data.get("history", [])
        )
    
    def to_dict(self) -> dict:
        return {
            "current_iteration": self.current_iteration,
            "max_iterations": self.max_iterations,
            "history": self.history
        }


def load_qa_tracking(spec_dir: Path) -> QATracking:
    """Load QA tracking state from implementation_plan.json."""
    plan_file = spec_dir / "implementation_plan.json"
    
    if not plan_file.exists():
        return QATracking(0, MAX_QA_ITERATIONS, [])

    try:
        with open(plan_file) as f:
            plan = json.load(f)
        qa_data = plan.get("qa_tracking", {})
        return QATracking.from_dict(qa_data)
    except (json.JSONDecodeError, OSError):
        return QATracking(0, MAX_QA_ITERATIONS, [])


def save_qa_tracking(spec_dir: Path, tracking: QATracking) -> None:
    """Save QA tracking state to implementation_plan.json."""
    plan_file = spec_dir / "implementation_plan.json"
    
    if not plan_file.exists():
        return
    
    try:
        with open(plan_file) as f:
            plan = json.load(f)
        
        plan["qa_tracking"] = tracking.to_dict()
        
        with open(plan_file, "w") as f:
            json.dump(plan, f, indent=2)
    except (json.JSONDecodeError, OSError):
        pass


def record_qa_iteration(
    spec_dir: Path,
    tracking: QATracking,
    result: QAResult
) -> QATracking:
    """Record a QA iteration result."""
    tracking.history.append({
        "iteration": result.iteration,
        "timestamp": result.timestamp,
        "status": "approved" if result.approved else "rejected",
        "issues_count": len(result.issues)
    })
    
    save_qa_tracking(spec_dir, tracking)
    return tracking


def get_iteration_context(tracking: QATracking) -> str:
    """Generate iteration context to inject into QA prompt."""
    return f"""
## QA ITERATION INFO

**Current iteration:** {tracking.current_iteration} / {tracking.max_iterations}

{"⚠️ WARNING: This is iteration 3+. Focus on CRITICAL issues only." if tracking.current_iteration >= 3 else ""}
{"🚨 FINAL ITERATIONS: Consider if remaining issues are truly blocking." if tracking.current_iteration >= 4 else ""}

**Previous iterations:**
{_format_history(tracking.history) if tracking.history else "None (first iteration)"}
"""


def _format_history(history: list[dict]) -> str:
    """Format iteration history for display."""
    lines = []
    for entry in history[-3:]:  # Show last 3 iterations
        status_icon = "✓" if entry["status"] == "approved" else "✗"
        lines.append(
            f"- Iteration {entry['iteration']}: {status_icon} {entry['status']} "
            f"({entry['issues_count']} issues)"
        )
    return "\n".join(lines)


def should_escalate(tracking: QATracking) -> bool:
    """Check if QA loop should escalate to human review."""
    return tracking.current_iteration >= tracking.max_iterations


def generate_escalation_report(spec_dir: Path, tracking: QATracking) -> str:
    """Generate escalation report when max iterations reached."""
    report = f"""# QA Escalation Report

**Spec Directory:** {spec_dir}
**Max Iterations Reached:** {tracking.max_iterations}
**Date:** {datetime.now(UTC).isoformat()}

## Summary

QA validation failed to approve after {tracking.max_iterations} iterations.
Human review is required to proceed.

## Iteration History

| Iteration | Status | Issues | Timestamp |
|-----------|--------|--------|-----------|
"""
    
    for entry in tracking.history:
        report += (
            f"| {entry['iteration']} | {entry['status']} | "
            f"{entry['issues_count']} | {entry['timestamp'][:19]} |\n"
        )
    
    report += """
## Recommended Actions

1. Review the persistent issues in QA_FIX_REQUEST.md
2. Consider if requirements need adjustment
3. Manually fix blocking issues
4. Re-run QA validation after fixes

## Files to Review

- `QA_FIX_REQUEST.md` - Latest fix requests
- `qa_report.md` - Latest QA report
- `implementation_plan.json` - Full QA tracking history
"""
    
    # Save report
    report_file = spec_dir / "QA_ESCALATION_REPORT.md"
    report_file.write_text(report)
    
    return report


def parse_qa_result(response: str, iteration: int) -> QAResult:
    """Parse QA agent response to extract result."""
    # Look for approval indicators
    approved = False
    if "SIGN-OFF: APPROVED" in response.upper() or "STATUS: APPROVED" in response.upper():
        approved = True
    
    # Extract issues (simplified parsing)
    issues = []
    if "Critical" in response or "CRITICAL" in response:
        # Count critical issues mentioned
        import re
        critical_matches = re.findall(r"(?:Critical|CRITICAL)[^:]*:\s*([^\n]+)", response)
        for match in critical_matches:
            issues.append({"type": "critical", "description": match.strip()})
    
    return QAResult(
        approved=approved,
        issues=issues,
        iteration=iteration,
        timestamp=datetime.now(UTC).isoformat()
    )
