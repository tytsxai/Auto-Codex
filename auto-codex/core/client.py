"""
LLM Client Configuration
========================

Codex-focused client setup and a lightweight adapter that preserves the
legacy streaming API used across agents.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, AsyncIterator, Optional

from core.auth import require_auth_token
from core.protocols import EventType, LLMClientProtocol, LLMEvent
from providers import CodexCliClient
from security import CodexSecurityConfig, get_security_profile


@dataclass
class TextBlock:
    text: str


@dataclass
class ToolUseBlock:
    name: str
    input: Any | None = None


@dataclass
class ToolResultBlock:
    content: Any | None = None
    is_error: bool = False


@dataclass
class AssistantMessage:
    content: list[Any]


@dataclass
class UserMessage:
    content: list[Any]


class CodexClientAdapter:
    """
    Adapter that exposes query/receive_response with Codex backing.

    Existing agent code expects legacy LLM-style messages, so we translate
    Codex events into minimal compatible message objects.
    """

    def __init__(self, client: LLMClientProtocol) -> None:
        self._client = client
        self._session_id: Optional[str] = None

    async def __aenter__(self) -> "CodexClientAdapter":
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        if self._session_id:
            await self._client.close(self._session_id)
            self._session_id = None

    def is_available(self) -> bool:
        return self._client.is_available()

    async def query(self, prompt: str, **kwargs) -> None:
        if self._session_id:
            await self._client.close(self._session_id)
        self._session_id = await self._client.start_session(prompt, **kwargs)

    async def receive_response(self) -> AsyncIterator[Any]:
        if not self._session_id:
            raise RuntimeError("No active session; call query() first.")

        async for event in self._client.stream_events(self._session_id):
            message = _event_to_message(event)
            if message:
                yield message

        await self._client.close(self._session_id)
        self._session_id = None


def _event_to_message(event: LLMEvent) -> Any | None:
    if event.type == EventType.TEXT:
        text = _extract_text(event)
        if text:
            return AssistantMessage(content=[TextBlock(text=text)])
        return None
    if event.type == EventType.TOOL_START:
        name = event.data.get("name") or event.data.get("tool") or "tool"
        return AssistantMessage(
            content=[ToolUseBlock(name=name, input=event.data.get("input"))]
        )
    if event.type == EventType.TOOL_RESULT:
        return UserMessage(
            content=[
                ToolResultBlock(
                    content=event.data.get("content"),
                    is_error=bool(event.data.get("is_error")),
                )
            ]
        )
    if event.type == EventType.ERROR:
        error_text = event.data.get("error") or "Unknown error"
        stderr = event.data.get("stderr")
        if stderr:
            error_text = f"{error_text}\n{stderr}"
        return AssistantMessage(content=[TextBlock(text=str(error_text))])
    return None


def _extract_text(event: LLMEvent) -> str:
    for key in ("text", "content", "raw"):
        value = event.data.get(key)
        if value:
            return str(value)
    return ""


def create_client(
    project_dir: Path | None,
    spec_dir: Path | None,
    model: str | None = None,
    agent_type: str = "coder",
    max_thinking_tokens: int | None = None,
) -> CodexClientAdapter:
    """
    Create a Codex-backed client with project security settings applied.

    Args:
        project_dir: Root directory for the project (working directory)
        spec_dir: Directory containing the spec (for security profiling)
        model: Codex model to use (legacy reasoning suffix like -xhigh is accepted but discouraged)
        agent_type: Agent role (reserved for future routing)
        max_thinking_tokens: Token budget used to infer Codex reasoning effort
    """
    require_auth_token()

    resolved_project_dir = Path(project_dir or Path.cwd()).resolve()
    resolved_spec_dir = (
        Path(spec_dir).resolve() if spec_dir is not None else resolved_project_dir
    )

    security_profile = get_security_profile(resolved_project_dir, resolved_spec_dir)
    codex_security_config = CodexSecurityConfig.from_security_profile(
        security_profile,
        allowed_paths=["./**"],
    )
    codex_security_args = codex_security_config.to_codex_args()

    reasoning_effort = _infer_reasoning_effort(max_thinking_tokens)

    # CodexCliClient will parse model string to extract base model and reasoning effort.
    # We additionally pass `reasoning_effort` inferred from the UI "thinking level"
    # (mapped via max_thinking_tokens budgets) so Codex uses the correct runtime setting
    # instead of relying on model-name suffixes.
    client = CodexCliClient(
        model=model,  # Will use AUTO_BUILD_MODEL env var if None
        reasoning_effort=reasoning_effort,
        workdir=str(resolved_project_dir),
        timeout=600,
        bypass_sandbox=(os.environ.get("AUTO_CODEX_BYPASS_CODEX_SANDBOX", "1") != "0"),
        extra_args=codex_security_args,
    )
    return CodexClientAdapter(client)


def get_client(provider: str = "codex", **kwargs) -> LLMClientProtocol:
    """Return a provider-backed client instance."""
    normalized = provider.lower()
    if normalized != "codex":
        raise ValueError(f"Unknown provider: {provider}")

    project_dir = kwargs.get("project_dir")
    workdir = str(project_dir) if project_dir is not None else None
    return CodexCliClient(
        model=kwargs.get("model"),  # Will use AUTO_BUILD_MODEL env var if None
        reasoning_effort=kwargs.get("reasoning_effort"),
        workdir=workdir,
        timeout=kwargs.get("timeout", 600),
        bypass_sandbox=kwargs.get("bypass_sandbox", True),
        extra_args=kwargs.get("extra_args"),
    )


def _infer_reasoning_effort(max_thinking_tokens: int | None) -> str | None:
    """
    Infer Codex `model_reasoning_effort` from the UI thinking token budget.

    The desktop UI expresses "thinking level" as a fixed token budget; Codex uses
    `model_reasoning_effort` (low/medium/high/xhigh). This keeps the public model
    ID stable (e.g. `gpt-5.2-codex`) and applies reasoning as a runtime parameter.
    """
    if max_thinking_tokens is None:
        return None

    budget_to_effort: dict[int, str] = {
        1024: "low",
        4096: "medium",
        16384: "high",
        65536: "xhigh",
    }
    return budget_to_effort.get(int(max_thinking_tokens))
