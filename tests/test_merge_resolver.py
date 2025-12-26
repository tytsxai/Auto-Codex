from datetime import datetime

from core.protocols import EventType, LLMEvent
from merge import (
    ChangeType,
    ConflictRegion,
    ConflictSeverity,
    MergeDecision,
    MergeStrategy,
    TaskSnapshot,
)
from merge.ai_resolver import create_llm_resolver
from merge.ai_resolver.prompts import SYSTEM_PROMPT

from tests.fixtures.codex_mocks import MockCodexClient


def test_llm_resolver_uses_provider(provider_switch):
    mock_client = provider_switch(
        client=MockCodexClient(
            responses=[
                LLMEvent(
                    type=EventType.TEXT,
                    data={"content": "```python\nprint('merged')\n```"},
                )
            ]
        )
    )
    resolver = create_llm_resolver()

    conflict = ConflictRegion(
        file_path="app.py",
        location="function:main",
        tasks_involved=["task-001"],
        change_types=[ChangeType.MODIFY_FUNCTION],
        severity=ConflictSeverity.MEDIUM,
        can_auto_merge=False,
        merge_strategy=MergeStrategy.AI_REQUIRED,
    )
    snapshot = TaskSnapshot(
        task_id="task-001",
        task_intent="Add logging",
        started_at=datetime.now(),
        semantic_changes=[],
    )

    result = resolver.resolve_conflict(conflict, "def main(): pass", [snapshot])

    assert result.decision == MergeDecision.AI_MERGED
    assert "print('merged')" in (result.merged_content or "")
    assert any(
        SYSTEM_PROMPT in call[1]
        for call in mock_client.calls
        if call[0] == "start_session"
    )
