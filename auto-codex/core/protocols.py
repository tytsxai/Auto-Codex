from collections.abc import AsyncIterator
from dataclasses import dataclass
from enum import Enum
from typing import Any, Protocol, runtime_checkable


class EventType(Enum):
    TEXT = "text"
    TOOL_START = "tool_start"
    TOOL_RESULT = "tool_result"
    ERROR = "error"
    SESSION_START = "session_start"
    SESSION_END = "session_end"
    THINKING = "thinking"
    REASONING = "reasoning"
    PROGRESS = "progress"
    TOOL_PENDING = "tool_pending"
    TURN_START = "turn_start"
    TURN_END = "turn_end"
    RATE_LIMIT = "rate_limit"


@dataclass
class LLMEvent:
    type: EventType
    data: dict[str, Any]
    timestamp: float | None = None


@runtime_checkable
class LLMClientProtocol(Protocol):
    """
    Base protocol for LLM client implementations.

    This is a single-turn execution protocol where each session runs
    one prompt to completion. Use ConversationalClientProtocol for
    multi-turn conversations.
    """

    async def start_session(self, prompt: str, **kwargs) -> str:
        """Start a new session with a prompt, return session ID."""
        ...

    async def stream_events(self, session_id: str) -> AsyncIterator[LLMEvent]:
        """Stream events from the session until completion."""
        ...

    async def close(self, session_id: str) -> None:
        """Close and cleanup a session."""
        ...

    def is_available(self) -> bool:
        """Check if this provider is available."""
        ...

    @property
    def supports_multi_turn(self) -> bool:
        """Whether this client supports multi-turn conversations."""
        ...


@runtime_checkable
class ConversationalClientProtocol(LLMClientProtocol, Protocol):
    """
    Extended protocol for clients that support multi-turn conversations.

    Adds send() method for continuing an existing session.
    """

    async def send(self, session_id: str, message: str) -> None:
        """Send a follow-up message to an existing session."""
        ...


@runtime_checkable
class LLMQueryClientProtocol(Protocol):
    """
    High-level client protocol used by agents.

    This protocol is intentionally separate from LLMClientProtocol:
    - LLMClientProtocol exposes provider/session primitives (events, session IDs)
    - LLMQueryClientProtocol exposes the legacy agent interface (query + streaming messages)
    """

    async def __aenter__(self) -> "LLMQueryClientProtocol":
        ...

    async def __aexit__(self, exc_type, exc, tb) -> None:
        ...

    def is_available(self) -> bool:
        ...

    async def query(self, prompt: str, **kwargs) -> None:
        ...

    async def receive_response(self) -> AsyncIterator[Any]:
        ...
