import importlib

import pytest
from core.protocols import EventType, LLMEvent

from tests.fixtures.codex_mocks import MockCodexClient


async def _run_session(client: MockCodexClient, prompt: str, message: str):
    session_id = await client.start_session(prompt, model="gpt-5.2-codex")
    await client.send(session_id, message)
    events = [event async for event in client.stream_events(session_id)]
    await client.close(session_id)
    return session_id, events


@pytest.mark.asyncio
async def test_codex_end_to_end_flow() -> None:
    responses = [
        LLMEvent(type=EventType.TEXT, data={"content": "hello"}),
        LLMEvent(type=EventType.TOOL_START, data={"name": "lookup", "input": {"q": "test"}}),
        LLMEvent(type=EventType.TOOL_RESULT, data={"result": "ok"}),
    ]
    client = MockCodexClient(responses=responses)

    session_id, events = await _run_session(client, "prompt", "message")

    assert session_id.startswith("mock-session-")
    assert [event.type for event in events] == [
        EventType.TEXT,
        EventType.TOOL_START,
        EventType.TOOL_RESULT,
    ]
    assert ("start_session", "prompt", {"model": "gpt-5.2-codex"}) in client.calls
    assert ("send", session_id, "message") in client.calls
    assert ("stream_events", session_id) in client.calls
    assert ("close", session_id) in client.calls


@pytest.mark.asyncio
async def test_codex_session_lifecycle() -> None:
    client = MockCodexClient()
    session_id = await client.start_session("setup")

    assert session_id in client.sessions
    await client.close(session_id)
    assert session_id not in client.sessions


@pytest.mark.asyncio
async def test_codex_error_recovery() -> None:
    client = MockCodexClient(
        responses=[LLMEvent(type=EventType.ERROR, data={"error": "boom"})]
    )
    first_session, events = await _run_session(client, "first", "ping")

    assert any(event.type == EventType.ERROR for event in events)
    assert first_session not in client.sessions

    client.responses = [LLMEvent(type=EventType.TEXT, data={"content": "recovered"})]
    _, recovered_events = await _run_session(client, "second", "pong")
    assert recovered_events[0].data["content"] == "recovered"


def test_provider_switch_fixture(provider_switch) -> None:
    client = provider_switch(provider="codex")

    client_module = importlib.import_module("core.client")

    assert client_module.get_client("codex") is client
