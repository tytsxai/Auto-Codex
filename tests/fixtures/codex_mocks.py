import asyncio
from collections.abc import AsyncIterator

from core.protocols import LLMClientProtocol, LLMEvent


class MockCodexClient(LLMClientProtocol):
    """Mock Codex client for testing."""

    def __init__(self, responses: list[LLMEvent] | None = None):
        self.responses = responses or []
        self.sessions: dict[str, dict[str, object]] = {}
        self.calls: list[tuple] = []
        # Mirror CodexCliClient defaults expected by robustness tests.
        self.bypass_sandbox = False

    def is_available(self) -> bool:
        return True

    async def start_session(self, prompt: str, **kwargs) -> str:
        self.calls.append(("start_session", prompt, kwargs))
        session_id = f"mock-session-{len(self.sessions)}"
        self.sessions[session_id] = {"prompt": prompt, "kwargs": kwargs}
        return session_id

    async def send(self, session_id: str, message: str) -> None:
        self.calls.append(("send", session_id, message))

    async def stream_events(self, session_id: str) -> AsyncIterator[LLMEvent]:
        self.calls.append(("stream_events", session_id))
        for event in self.responses:
            await asyncio.sleep(0)
            yield event

    async def close(self, session_id: str) -> None:
        self.calls.append(("close", session_id))
        if session_id in self.sessions:
            del self.sessions[session_id]
