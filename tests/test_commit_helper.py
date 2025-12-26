from pathlib import Path

from commit_message import generate_commit_message_sync
from core.protocols import EventType, LLMEvent

from tests.fixtures.codex_mocks import MockCodexClient


def test_commit_message_uses_provider(provider_switch, tmp_path: Path):
    mock_client = MockCodexClient(
        responses=[
            LLMEvent(
                type=EventType.TEXT,
                data={"content": "feat(core): add provider adapter\n\nDone.\n"},
            )
        ]
    )
    provider_switch(client=mock_client)

    spec_dir = tmp_path / ".auto-codex" / "specs" / "spec-001"
    spec_dir.mkdir(parents=True)
    (spec_dir / "spec.md").write_text("# Add provider adapter\n", encoding="utf-8")

    result = generate_commit_message_sync(
        project_dir=tmp_path,
        spec_name="spec-001",
        diff_summary="1 file changed",
        files_changed=["auto-codex/core/client.py"],
    )

    assert result.startswith("feat(core): add provider adapter")
    assert any(call[0] == "start_session" for call in mock_client.calls)
