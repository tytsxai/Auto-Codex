import re
import sys
from pathlib import Path

import pytest

# Ensure core.client is not mocked by other test modules
if 'core.client' in sys.modules:
    _mod = sys.modules['core.client']
    if not hasattr(_mod, '__file__'):
        del sys.modules['core.client']

from core.client import CodexClientAdapter, TextBlock, ToolResultBlock, ToolUseBlock
from core.protocols import EventType, LLMEvent

from tests.fixtures.codex_mocks import MockCodexClient


@pytest.mark.asyncio
async def test_codex_adapter_translates_events() -> None:
    events = [
        LLMEvent(type=EventType.TEXT, data={"content": "hello"}),
        LLMEvent(type=EventType.TOOL_START, data={"name": "Read", "input": {"path": "README.md"}}),
        LLMEvent(type=EventType.TOOL_RESULT, data={"content": "ok", "is_error": False}),
    ]
    adapter = CodexClientAdapter(MockCodexClient(responses=events))

    await adapter.query("prompt")
    messages = [msg async for msg in adapter.receive_response()]

    assert messages, "Expected translated messages"
    assert any(
        isinstance(block, TextBlock)
        for msg in messages
        for block in getattr(msg, "content", [])
    )
    assert any(
        isinstance(block, ToolUseBlock)
        for msg in messages
        for block in getattr(msg, "content", [])
    )
    assert any(
        isinstance(block, ToolResultBlock)
        for msg in messages
        for block in getattr(msg, "content", [])
    )


def test_no_legacy_sdk_imports() -> None:
    root = Path(__file__).parent.parent / "auto-codex"
    patterns = [
        re.compile(r"claude_agent_sdk"),
        re.compile(r"ClaudeSDKClient"),
        re.compile(r"claude_sdk"),
    ]

    for path in root.rglob("*.py"):
        if ".venv" in path.parts:
            continue
        content = path.read_text()
        for pattern in patterns:
            assert not pattern.search(content), f"Legacy SDK reference found in {path}"
