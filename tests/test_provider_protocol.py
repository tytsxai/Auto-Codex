import pytest
from core.protocols import (
    ConversationalClientProtocol,
    EventType,
    LLMClientProtocol,
    LLMEvent,
    LLMQueryClientProtocol,
)

from tests.fixtures.codex_mocks import MockCodexClient


def test_protocol_defines_required_methods() -> None:
    base_required = {
        "start_session",
        "stream_events",
        "close",
        "is_available",
        "supports_multi_turn",
    }
    assert base_required.issubset(set(dir(LLMClientProtocol)))

    conversational_required = {"send"}
    assert conversational_required.issubset(set(dir(ConversationalClientProtocol)))

    query_required = {"query", "receive_response", "is_available"}
    assert query_required.issubset(set(dir(LLMQueryClientProtocol)))


@pytest.mark.asyncio
async def test_mock_client_works() -> None:
    class MockClient:
        def __init__(self) -> None:
            self.sessions: dict[str, list[str]] = {}

        @property
        def supports_multi_turn(self) -> bool:
            return True

        async def start_session(self, prompt: str, **kwargs) -> str:
            session_id = f"session-{len(self.sessions) + 1}"
            self.sessions[session_id] = [prompt]
            return session_id

        async def send(self, session_id: str, message: str) -> None:
            self.sessions[session_id].append(message)

        async def stream_events(self, session_id: str):
            for text in self.sessions[session_id]:
                yield LLMEvent(type=EventType.TEXT, data={"text": text})

        async def close(self, session_id: str) -> None:
            self.sessions.pop(session_id, None)

        def is_available(self) -> bool:
            return True

    client = MockClient()
    session_id = await client.start_session("hello")
    await client.send(session_id, "world")

    events = [event async for event in client.stream_events(session_id)]
    assert [event.data["text"] for event in events] == ["hello", "world"]

    await client.close(session_id)
    assert session_id not in client.sessions
    assert client.is_available() is True


@pytest.mark.asyncio
async def test_mock_codex_client_streams_events() -> None:
    events = [
        LLMEvent(type=EventType.TEXT, data={"content": "hello"}),
        LLMEvent(type=EventType.TOOL_START, data={"name": "lookup"}),
    ]
    client = MockCodexClient(responses=events)
    session_id = await client.start_session("prompt")
    await client.send(session_id, "message")

    streamed = [event async for event in client.stream_events(session_id)]

    assert [event.type for event in streamed] == [EventType.TEXT, EventType.TOOL_START]
    await client.close(session_id)
