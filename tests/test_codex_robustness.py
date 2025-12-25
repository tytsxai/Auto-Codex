"""
Regression tests for Codex CLI robustness improvements.

Tests cover:
1. Protocol semantics (send() not supported)
2. Idle watchdog detection
3. Security status self-check
4. Audit logging
"""

import asyncio
import pytest
from unittest.mock import MagicMock, patch, AsyncMock


class TestCodexCliClientProtocol:
    """Tests for CodexCliClient protocol compliance."""

    def test_supports_multi_turn_is_false(self):
        """CodexCliClient should report it doesn't support multi-turn."""
        from providers.codex_cli import CodexCliClient

        client = CodexCliClient(model="test-model")
        assert client.supports_multi_turn is False
        assert client.bypass_sandbox is False

    @pytest.mark.asyncio
    async def test_send_raises_runtime_error(self):
        """send() should raise RuntimeError with clear message."""
        from providers.codex_cli import CodexCliClient

        client = CodexCliClient(model="test-model")

        with pytest.raises(RuntimeError) as exc_info:
            await client.send("fake-session-id", "test message")

        assert "does not support send()" in str(exc_info.value)
        assert "start a new session" in str(exc_info.value)


class TestClientFactoryDefaults:
    def test_get_client_default_does_not_bypass(self):
        from core.client import get_client

        client = get_client()
        assert getattr(client, "bypass_sandbox", None) is False


class TestIdleWatchdog:
    """Tests for idle timeout watchdog."""

    def test_default_idle_timeout(self):
        """Default idle timeout should be 300 seconds."""
        from providers.codex_cli import CodexCliClient, DEFAULT_IDLE_TIMEOUT

        assert DEFAULT_IDLE_TIMEOUT == 300
        client = CodexCliClient(model="test-model")
        assert client.idle_timeout == 300

    def test_custom_idle_timeout(self):
        """Custom idle timeout should be respected."""
        from providers.codex_cli import CodexCliClient

        client = CodexCliClient(model="test-model", idle_timeout=60)
        assert client.idle_timeout == 60

    def test_session_has_last_activity(self):
        """CodexSession should track last_activity timestamp."""
        from providers.codex_cli import CodexSession

        session = CodexSession(session_id="test")
        assert hasattr(session, "last_activity")
        assert session.last_activity == 0.0

    @pytest.mark.asyncio
    async def test_stderr_updates_last_activity(self):
        """stderr output should count as activity for idle watchdog."""
        from providers.codex_cli import CodexCliClient, CodexSession

        class FakeStderr:
            def __init__(self, chunks: list[bytes]) -> None:
                self._chunks = chunks

            async def read(self, _n: int) -> bytes:
                if not self._chunks:
                    return b""
                return self._chunks.pop(0)

        class FakeProcess:
            def __init__(self) -> None:
                self.stderr = FakeStderr([b"warn: something\n", b""])

        client = CodexCliClient(model="test-model")
        session = CodexSession(session_id="test", process=FakeProcess())
        session.last_activity = 0.0

        await client._drain_stderr(session)

        assert "warn:" in session.stderr_tail
        assert session.last_activity != 0.0


class TestSecurityStatus:
    """Tests for security configuration self-check."""

    def test_bypass_mode(self):
        """Bypass sandbox should report bypass mode."""
        from security.codex_config import CodexSecurityConfig

        config = CodexSecurityConfig(bypass_sandbox=True)
        status = config.get_security_status()

        assert status["mode"] == "bypass"
        assert status["bypass_sandbox"] is True

    def test_enforced_mode_default(self):
        """Default mode should be enforced with workspace-write sandbox."""
        from security.codex_config import CodexSecurityConfig

        config = CodexSecurityConfig()
        status = config.get_security_status()

        assert status["mode"] == "enforced"
        assert status["sandbox_mode"] == "workspace-write"

    def test_sandbox_mode_in_bypass(self):
        """Bypass mode should report danger-full-access sandbox mode."""
        from security.codex_config import CodexSecurityConfig

        config = CodexSecurityConfig(bypass_sandbox=True)
        status = config.get_security_status()

        assert status["mode"] == "bypass"
        assert status["sandbox_mode"] == "danger-full-access"


class TestEventTypes:
    """Tests for extended event types."""

    def test_new_event_types_exist(self):
        """New event types should be defined."""
        from core.protocols import EventType

        # Check new event types exist
        assert hasattr(EventType, "THINKING")
        assert hasattr(EventType, "REASONING")
        assert hasattr(EventType, "PROGRESS")
        assert hasattr(EventType, "TOOL_PENDING")
        assert hasattr(EventType, "TURN_START")
        assert hasattr(EventType, "TURN_END")
        assert hasattr(EventType, "RATE_LIMIT")

    def test_event_type_values(self):
        """Event type values should be correct."""
        from core.protocols import EventType

        assert EventType.REASONING.value == "reasoning"
        assert EventType.PROGRESS.value == "progress"
        assert EventType.RATE_LIMIT.value == "rate_limit"


class TestRetryMechanism:
    """Tests for retry decorator."""

    def test_with_retry_decorator_exists(self):
        """with_retry decorator should be importable."""
        from providers.codex_cli import with_retry

        assert callable(with_retry)

    @pytest.mark.asyncio
    async def test_retry_on_connection_error(self):
        """Retry should trigger on ConnectionError."""
        from providers.codex_cli import with_retry

        call_count = 0

        @with_retry(max_retries=3, base_delay=0.01)
        async def failing_func():
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise ConnectionError("test error")
            return "success"

        result = await failing_func()
        assert result == "success"
        assert call_count == 3
