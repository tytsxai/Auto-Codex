import importlib

import pytest
from core.protocols import EventType, LLMEvent

from tests.fixtures.codex_mocks import MockCodexClient


@pytest.mark.asyncio
async def test_llm_analysis_client_streams_text(provider_switch, tmp_path):
    mock_client = MockCodexClient(
        responses=[LLMEvent(type=EventType.TEXT, data={"content": '{"ok": true}'})]
    )
    provider_switch(client=mock_client)

    module = importlib.import_module("runners.ai_analyzer.llm_client")
    importlib.reload(module)

    client = module.LLMAnalysisClient(tmp_path)
    result = await client.run_analysis_query("Analyze the repo")

    assert result == '{"ok": true}'
    start_calls = [call for call in mock_client.calls if call[0] == "start_session"]
    assert start_calls
    assert "Analyze the repo" in start_calls[0][1]
    assert "senior software architect" in start_calls[0][1]
