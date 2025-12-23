import sys

import pytest

from core.protocols import EventType
from providers.codex_cli import CodexCliClient


def _python_cmd(script: str) -> list[str]:
    return [sys.executable, "-u", "-c", script]


@pytest.mark.asyncio
async def test_start_and_close_session(monkeypatch: pytest.MonkeyPatch) -> None:
    client = CodexCliClient(timeout=1)

    def fake_build_command(prompt: str, **kwargs) -> list[str]:
        script = "import time; time.sleep(5)"
        return _python_cmd(script)

    monkeypatch.setattr(client, "_build_command", fake_build_command)

    session_id = await client.start_session("hello")
    assert session_id in client._sessions

    await client.close(session_id)
    assert session_id not in client._sessions


@pytest.mark.asyncio
async def test_stream_events_parses_output(monkeypatch: pytest.MonkeyPatch) -> None:
    client = CodexCliClient(timeout=1)

    def fake_build_command(prompt: str, **kwargs) -> list[str]:
        script = (
            "import sys, json; "
            "line = sys.stdin.readline().strip(); "
            "print(json.dumps({'type': 'message', 'content': line})); "
            "print(json.dumps({'type': 'tool_use', 'name': 'lookup'})); "
            "print('not-json'); "
            "sys.stdout.flush()"
        )
        return _python_cmd(script)

    monkeypatch.setattr(client, "_build_command", fake_build_command)

    session_id = await client.start_session("hello")
    events = [event async for event in client.stream_events(session_id)]

    types = [event.type for event in events]
    assert types[0] == EventType.SESSION_START
    assert EventType.TEXT in types
    assert EventType.TOOL_START in types
    assert types[-1] == EventType.SESSION_END

    text_events = [event for event in events if event.type == EventType.TEXT]
    assert any(event.data.get("content") == "hello" for event in text_events)


def test_parse_output_line_variants() -> None:
    client = CodexCliClient()

    message = client._parse_output_line('{"type":"message","content":"hi"}')
    assert message.type == EventType.TEXT
    assert message.data["content"] == "hi"

    tool_use = client._parse_output_line('{"type":"tool_use","name":"t"}')
    assert tool_use.type == EventType.TOOL_START

    tool_result = client._parse_output_line('{"type":"tool_result","ok":true}')
    assert tool_result.type == EventType.TOOL_RESULT

    error = client._parse_output_line('{"type":"error","detail":"bad"}')
    assert error.type == EventType.ERROR

    non_json = client._parse_output_line("not json")
    assert non_json.type == EventType.TEXT
    assert non_json.data["content"] == "not json"


def test_legacy_model_suffix_is_parsed_as_reasoning_effort() -> None:
    client = CodexCliClient(model="gpt-5.2-codex-xhigh")
    assert client.model == "gpt-5.2-codex"
    assert client.reasoning_effort == "xhigh"


def test_explicit_reasoning_effort_overrides_suffix() -> None:
    client = CodexCliClient(model="gpt-5.2-codex-xhigh", reasoning_effort="low")
    assert client.model == "gpt-5.2-codex"
    assert client.reasoning_effort == "low"


@pytest.mark.asyncio
async def test_process_crash_emits_error(monkeypatch: pytest.MonkeyPatch) -> None:
    client = CodexCliClient(timeout=1)

    def fake_build_command(prompt: str, **kwargs) -> list[str]:
        script = "import sys; sys.stderr.write('boom'); sys.exit(2)"
        return _python_cmd(script)

    monkeypatch.setattr(client, "_build_command", fake_build_command)

    session_id = await client.start_session("hello")
    events = [event async for event in client.stream_events(session_id)]

    errors = [event for event in events if event.type == EventType.ERROR]
    assert errors
    assert any(event.data.get("returncode") == 2 for event in errors)


@pytest.mark.asyncio
async def test_timeout_emits_error(monkeypatch: pytest.MonkeyPatch) -> None:
    client = CodexCliClient(timeout=0.1)

    def fake_build_command(prompt: str, **kwargs) -> list[str]:
        script = "import time; time.sleep(1)"
        return _python_cmd(script)

    monkeypatch.setattr(client, "_build_command", fake_build_command)

    session_id = await client.start_session("hello")
    events = [event async for event in client.stream_events(session_id)]

    errors = [event for event in events if event.type == EventType.ERROR]
    assert any("timeout" in event.data.get("error", "") for event in errors)


def test_is_available_checks_env(monkeypatch: pytest.MonkeyPatch) -> None:
    import providers.codex_cli as codex_cli

    client = CodexCliClient()

    monkeypatch.setattr(codex_cli, "find_codex_path", lambda: "/usr/bin/codex")
    monkeypatch.setattr(codex_cli, "get_auth_token", lambda: "test-token")
    assert client.is_available() is True

    monkeypatch.setattr(codex_cli, "find_codex_path", lambda: None)
    assert client.is_available() is False

    monkeypatch.setattr(codex_cli, "find_codex_path", lambda: "/usr/bin/codex")
    monkeypatch.setattr(codex_cli, "get_auth_token", lambda: "")
    assert client.is_available() is False
