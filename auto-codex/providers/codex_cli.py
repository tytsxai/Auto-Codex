import asyncio
import functools
import json
import os
import random
import shutil
import time
import uuid
from dataclasses import dataclass
from typing import Any, AsyncIterator, Optional

from core.auth import get_auth_token
from core.debug import debug_warning
from core.protocols import EventType, LLMClientProtocol, LLMEvent

# Valid reasoning effort levels
VALID_REASONING_EFFORTS = ("low", "medium", "high", "xhigh")

# Default model and reasoning effort from environment
DEFAULT_MODEL = os.environ.get("AUTO_BUILD_MODEL", "gpt-5.2-codex")


def normalize_reasoning_effort(value: str | None) -> str:
    if not value:
        return "medium"
    normalized = value.strip().lower()
    if normalized in VALID_REASONING_EFFORTS:
        return normalized
    return "medium"


_ENV_REASONING_EFFORT = os.environ.get("AUTO_BUILD_REASONING_EFFORT")
DEFAULT_REASONING_EFFORT = (
    normalize_reasoning_effort(_ENV_REASONING_EFFORT)
    if _ENV_REASONING_EFFORT
    else None
)

# Common codex installation paths (for GUI apps that don't inherit shell PATH)
CODEX_SEARCH_PATHS = [
    "/opt/homebrew/bin/codex",  # macOS ARM (Homebrew)
    "/usr/local/bin/codex",     # macOS Intel (Homebrew) / Linux
    "/usr/bin/codex",           # System-wide Linux
    os.path.expanduser("~/.local/bin/codex"),  # User-local
    os.path.expanduser("~/.npm-global/bin/codex"),  # npm global
]

# GUI apps launched from Finder don't inherit shell PATH, so we need to provide it
GUI_PATH_ADDITIONS = [
    "/opt/homebrew/bin",        # macOS ARM (Homebrew)
    "/usr/local/bin",           # macOS Intel (Homebrew) / Linux
    "/usr/bin",                 # System binaries
    "/bin",                     # Core binaries
    os.path.expanduser("~/.local/bin"),
    os.path.expanduser("~/.npm-global/bin"),
]


def get_gui_env() -> dict[str, str]:
    """
    Get environment variables with PATH suitable for GUI apps.

    GUI apps launched from Finder don't inherit the user's shell PATH,
    so we need to explicitly add common binary locations.
    """
    env = os.environ.copy()
    current_path = env.get("PATH", "")

    # Add GUI path additions that aren't already in PATH
    path_parts = current_path.split(os.pathsep) if current_path else []
    for addition in GUI_PATH_ADDITIONS:
        if addition not in path_parts and os.path.isdir(addition):
            path_parts.insert(0, addition)

    env["PATH"] = os.pathsep.join(path_parts)
    return env


def find_codex_path() -> str | None:
    """
    Find the codex CLI executable path.

    First tries shutil.which (works in terminal), then falls back to
    common installation paths (needed for GUI apps launched from Finder).
    """
    # Try PATH first (works in terminal)
    codex_path = shutil.which("codex")
    if codex_path:
        return codex_path

    # Fallback: check common installation paths
    for path in CODEX_SEARCH_PATHS:
        if os.path.isfile(path) and os.access(path, os.X_OK):
            return path

    return None


def parse_model_string(model_str: str) -> tuple[str, str | None, bool]:
    """
    Parse a model string that may include reasoning effort suffix.

    Examples:
        "gpt-5.2-codex-xhigh" -> ("gpt-5.2-codex", "xhigh")  # legacy suffix form
        "gpt-5.2-codex" -> ("gpt-5.2-codex", DEFAULT_REASONING_EFFORT)
        "gpt-4o" -> ("gpt-4o", DEFAULT_REASONING_EFFORT)

    Returns:
        Tuple of (model_name, reasoning_effort, has_suffix)
    """
    # Check if the string ends with a valid reasoning effort suffix
    for effort in VALID_REASONING_EFFORTS:
        suffix = f"-{effort}"
        if model_str.endswith(suffix):
            base_model = model_str[:-len(suffix)]
            return (base_model, effort, True)

    # No reasoning effort suffix found, use default
    return (model_str, DEFAULT_REASONING_EFFORT, False)


def with_retry(max_retries: int = 3, base_delay: float = 1.0, max_delay: float = 30.0):
    """指数退避重试装饰器"""
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            last_error = None
            for attempt in range(max_retries):
                try:
                    return await func(*args, **kwargs)
                except (ConnectionError, TimeoutError, BrokenPipeError) as e:
                    last_error = e
                    if attempt < max_retries - 1:
                        delay = min(base_delay * (2 ** attempt) + random.uniform(0, 1), max_delay)
                        await asyncio.sleep(delay)
            raise last_error
        return wrapper
    return decorator


@dataclass
class CodexSession:
    """Tracks a running Codex CLI session."""

    session_id: str
    process: Optional[asyncio.subprocess.Process] = None
    workdir: str = ""
    closed: bool = False
    stderr_task: Optional[asyncio.Task[None]] = None
    stderr_tail: str = ""
    last_activity: float = 0.0  # Timestamp of last output
    start_time: float = 0.0  # Timestamp when session started


# Default idle timeout (seconds) - kill if no output for this long
DEFAULT_IDLE_TIMEOUT = 300  # 5 minutes
# Default max runtime (seconds) - kill if running longer than this
DEFAULT_MAX_RUNTIME = 3600  # 60 minutes


class CodexCliClient(LLMClientProtocol):
    """Codex CLI adapter implementing LLMClientProtocol."""

    def __init__(
        self,
        model: str | None = None,
        reasoning_effort: str | None = None,
        workdir: Optional[str] = None,
        timeout: int = 600,
        idle_timeout: int = DEFAULT_IDLE_TIMEOUT,
        max_runtime: int = DEFAULT_MAX_RUNTIME,
        bypass_sandbox: bool = False,
        extra_args: Optional[list[str]] = None,
    ) -> None:
        # Parse model string to extract base model and (optional) reasoning effort.
        # We treat any "-low/-medium/-high/-xhigh" suffix as legacy input and
        # always translate it into `model_reasoning_effort` instead of passing
        # a synthetic model name to the Codex CLI.
        raw_model = model or os.environ.get("AUTO_BUILD_MODEL", DEFAULT_MODEL)
        parsed_model, parsed_effort, _has_suffix = parse_model_string(raw_model)

        explicit_effort = normalize_reasoning_effort(reasoning_effort) if reasoning_effort else None
        self.model = parsed_model
        self.reasoning_effort = explicit_effort or parsed_effort
        self.workdir = workdir or os.getcwd()
        self.timeout = timeout
        self.idle_timeout = idle_timeout
        self.max_runtime = max_runtime
        self.bypass_sandbox = bypass_sandbox
        self.extra_args = extra_args or []
        self._sessions: dict[str, CodexSession] = {}

    @property
    def supports_multi_turn(self) -> bool:
        """CodexCliClient is single-turn only (no send() after start)."""
        return False

    def is_available(self) -> bool:
        """
        Check if codex CLI is installed and authentication is configured.

        Codex can authenticate via:
        - OPENAI_API_KEY
        - CODEX_CODE_OAUTH_TOKEN
        - CODEX_CONFIG_DIR
        """
        if not find_codex_path():
            return False

        return bool(get_auth_token())

    @with_retry(max_retries=3, base_delay=1.0)
    async def start_session(self, prompt: str, **kwargs) -> str:
        """Start a new Codex CLI session."""
        session_id = str(uuid.uuid4())
        cmd = self._build_command(prompt, **kwargs)
        workdir = kwargs.get("workdir", self.workdir)

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=workdir,
            env=get_gui_env(),
        )

        if process.stdin:
            try:
                process.stdin.write(prompt.encode() + b"\n")
                await process.stdin.drain()
            except (BrokenPipeError, ConnectionResetError):
                pass
            finally:
                try:
                    process.stdin.close()
                except Exception as e:
                    debug_warning("codex_cli", "Failed to close stdin", error=str(e))

        session = CodexSession(session_id=session_id, process=process, workdir=workdir, start_time=time.time())
        session.stderr_task = asyncio.create_task(self._drain_stderr(session))
        self._sessions[session_id] = session
        return session_id

    def _build_command(self, prompt: str, **kwargs) -> list[str]:
        """Build the codex CLI command."""
        # Use full path to codex (needed for GUI apps launched from Finder)
        codex_path = find_codex_path() or "codex"
        cmd = [codex_path, "exec"]

        if self.bypass_sandbox:
            cmd.append("--dangerously-bypass-approvals-and-sandbox")

        # Model name (e.g., gpt-5.2-codex, gpt-4o)
        cmd.extend(["-m", self.model])

        # Reasoning effort level (low, medium, high, xhigh)
        if self.reasoning_effort:
            cmd.extend(["-c", f"model_reasoning_effort={self.reasoning_effort}"])

        cmd.append("--json")
        cmd.extend(self.extra_args)
        cmd.append("-")
        return cmd

    async def send(self, session_id: str, message: str) -> None:
        """Send input to the session's stdin."""
        # This client runs `codex exec ... -` and closes stdin after writing the
        # initial prompt (EOF signals end-of-input). Follow-up send() is not
        # supported; callers should start a new session instead.
        raise RuntimeError(
            "CodexCliClient does not support send() after start_session(); "
            "start a new session instead."
        )

    async def stream_events(self, session_id: str) -> AsyncIterator[LLMEvent]:
        """Stream and parse Codex CLI JSON output with idle watchdog."""
        session = self._sessions.get(session_id)
        if not session or not session.process:
            raise ValueError(f"Session {session_id} not found")

        process = session.process
        session.last_activity = time.time()
        yield LLMEvent(type=EventType.SESSION_START, data={"session_id": session_id})

        try:
            while True:
                try:
                    # Use shorter timeout for readline, check idle separately
                    read_timeout = min(self.timeout, 30) if self.timeout > 0 else 30
                    line = await asyncio.wait_for(
                        process.stdout.readline(), timeout=read_timeout
                    )
                except asyncio.TimeoutError:
                    # Check if we've exceeded max runtime
                    if session.start_time > 0 and self.max_runtime > 0:
                        runtime = time.time() - session.start_time
                        if runtime > self.max_runtime:
                            yield LLMEvent(
                                type=EventType.ERROR,
                                data={
                                    "error": f"max runtime exceeded ({int(runtime)}s > {self.max_runtime}s)",
                                    "stderr_tail": session.stderr_tail[-4000:],
                                },
                            )
                            await self._terminate_process(process)
                            break
                    # Check if we've been idle too long (no output at all)
                    idle_time = time.time() - session.last_activity
                    if self.idle_timeout > 0 and idle_time > self.idle_timeout:
                        yield LLMEvent(
                            type=EventType.ERROR,
                            data={
                                "error": f"idle timeout ({int(idle_time)}s without output)",
                                "stderr_tail": session.stderr_tail[-4000:],
                            },
                        )
                        await self._terminate_process(process)
                        break
                    # Not idle too long, continue waiting
                    continue

                if not line:
                    break

                # Update activity timestamp on any output
                session.last_activity = time.time()
                event = self._parse_output_line(line.decode(errors="replace").strip())
                if event:
                    yield event
        except Exception as exc:
            yield LLMEvent(type=EventType.ERROR, data={"error": str(exc)})

        returncode = process.returncode
        if returncode is None:
            returncode = await process.wait()
        if returncode != 0:
            stderr = session.stderr_tail.strip()
            yield LLMEvent(
                type=EventType.ERROR,
                data={"error": "process exited with error", "returncode": returncode, "stderr": stderr},
            )

        await self.close(session_id)
        yield LLMEvent(type=EventType.SESSION_END, data={"session_id": session_id})

    def _parse_output_line(self, line: str) -> Optional[LLMEvent]:
        """Parse a single line of Codex CLI JSON output."""
        if not line:
            return None

        try:
            data = json.loads(line)
        except json.JSONDecodeError:
            return LLMEvent(type=EventType.TEXT, data={"content": line})

        event_type = data.get("type", "")

        # Legacy event types
        if event_type == "message":
            return LLMEvent(type=EventType.TEXT, data={"content": data.get("content", "")})
        if event_type == "tool_use":
            return LLMEvent(type=EventType.TOOL_START, data=data)
        if event_type == "tool_result":
            return LLMEvent(type=EventType.TOOL_RESULT, data=data)
        if event_type == "error":
            return LLMEvent(type=EventType.ERROR, data=data)

        # New Codex CLI event types (v0.77+)
        if event_type == "item.completed":
            item = data.get("item", {})
            item_type = item.get("type", "")
            if item_type == "reasoning":
                summary = item.get("summary", [])
                text = "\n".join(s.get("text", "") for s in summary if s.get("text"))
                if text:
                    return LLMEvent(type=EventType.REASONING, data={"content": text})
                return None
            text = item.get("text", "")
            if item_type == "agent_message" and text:
                return LLMEvent(type=EventType.TEXT, data={"content": text})
            if item_type == "tool_use":
                return LLMEvent(type=EventType.TOOL_START, data={"name": item.get("name", "tool"), "input": item.get("input")})
            if item_type == "tool_result":
                return LLMEvent(type=EventType.TOOL_RESULT, data={"content": item.get("output")})
            return None

        if event_type == "progress":
            return LLMEvent(type=EventType.PROGRESS, data=data)

        if event_type == "turn.started":
            return LLMEvent(type=EventType.TURN_START, data=data)

        if event_type == "turn.completed":
            return LLMEvent(type=EventType.TURN_END, data=data)

        if event_type == "rate_limit" or "rate" in event_type.lower():
            return LLMEvent(type=EventType.RATE_LIMIT, data=data)

        if event_type == "item.started":
            item = data.get("item", {})
            if item.get("type") == "tool_use":
                return LLMEvent(type=EventType.TOOL_PENDING, data={"name": item.get("name", "tool")})
            return None

        if event_type == "thread.started":
            return None

        return LLMEvent(type=EventType.TEXT, data={"raw": line})

    async def close(self, session_id: str) -> None:
        """Close and cleanup a session."""
        session = self._sessions.get(session_id)
        if not session or session.closed:
            self._sessions.pop(session_id, None)
            return

        if session.process:
            await self._terminate_process(session.process)

        if session.stderr_task:
            session.stderr_task.cancel()
            try:
                await session.stderr_task
            except Exception as e:
                debug_warning("codex_cli", "Failed to await stderr task", error=str(e))

        session.closed = True
        self._sessions.pop(session_id, None)

    async def _terminate_process(self, process: asyncio.subprocess.Process) -> None:
        if process.returncode is not None:
            return
        process.terminate()
        try:
            await asyncio.wait_for(process.wait(), timeout=5)
        except asyncio.TimeoutError:
            process.kill()
            await process.wait()

    async def _drain_stderr(self, session: CodexSession) -> None:
        """
        Drain stderr in the background to prevent deadlocks.

        Some environments produce substantial stderr output; if nobody reads it,
        the process can block once the pipe buffer fills.
        """
        process = session.process
        if not process or not process.stderr:
            return

        max_tail_chars = 64_000

        try:
            while True:
                chunk = await process.stderr.read(4096)
                if not chunk:
                    break
                # Treat stderr output as activity so the idle watchdog doesn't
                # kill a process that's still emitting diagnostics.
                session.last_activity = time.time()
                text = chunk.decode(errors="replace")
                session.stderr_tail = (session.stderr_tail + text)[-max_tail_chars:]
        except asyncio.CancelledError:
            raise
        except Exception as e:
            # Best-effort: stderr is only for diagnostics.
            debug_warning("codex_cli", "Failed to drain stderr", error=str(e))
            return
