import asyncio
import json
import os
import shutil
import uuid
from dataclasses import dataclass
from typing import Any, AsyncIterator, Optional

from core.auth import get_auth_token
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


@dataclass
class CodexSession:
    """Tracks a running Codex CLI session."""

    session_id: str
    process: Optional[asyncio.subprocess.Process] = None
    workdir: str = ""
    closed: bool = False


class CodexCliClient(LLMClientProtocol):
    """Codex CLI adapter implementing LLMClientProtocol."""

    def __init__(
        self,
        model: str | None = None,
        reasoning_effort: str | None = None,
        workdir: Optional[str] = None,
        timeout: int = 600,
        bypass_sandbox: bool = True,
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
        self.bypass_sandbox = bypass_sandbox
        self.extra_args = extra_args or []
        self._sessions: dict[str, CodexSession] = {}

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
            process.stdin.write(prompt.encode() + b"\n")
            await process.stdin.drain()
            process.stdin.close()

        self._sessions[session_id] = CodexSession(
            session_id=session_id, process=process, workdir=workdir
        )
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
        session = self._sessions.get(session_id)
        if not session or not session.process or session.closed:
            raise ValueError(f"Session {session_id} not found")

        if not session.process.stdin:
            raise RuntimeError("Session stdin is not available")

        session.process.stdin.write(message.encode() + b"\n")
        await session.process.stdin.drain()

    async def stream_events(self, session_id: str) -> AsyncIterator[LLMEvent]:
        """Stream and parse Codex CLI JSON output."""
        session = self._sessions.get(session_id)
        if not session or not session.process:
            raise ValueError(f"Session {session_id} not found")

        process = session.process
        yield LLMEvent(type=EventType.SESSION_START, data={"session_id": session_id})

        try:
            while True:
                try:
                    if self.timeout and self.timeout > 0:
                        line = await asyncio.wait_for(
                            process.stdout.readline(), timeout=self.timeout
                        )
                    else:
                        line = await process.stdout.readline()
                except asyncio.TimeoutError:
                    yield LLMEvent(
                        type=EventType.ERROR,
                        data={"error": "timeout waiting for output"},
                    )
                    await self._terminate_process(process)
                    break

                if not line:
                    break

                event = self._parse_output_line(line.decode(errors="replace").strip())
                if event:
                    yield event
        except Exception as exc:
            yield LLMEvent(type=EventType.ERROR, data={"error": str(exc)})

        returncode = process.returncode
        if returncode is None:
            returncode = await process.wait()
        if returncode != 0:
            stderr = ""
            if process.stderr:
                stderr = (await process.stderr.read()).decode(errors="replace").strip()
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
            text = item.get("text", "")
            if item_type == "agent_message" and text:
                return LLMEvent(type=EventType.TEXT, data={"content": text})
            if item_type == "tool_use":
                return LLMEvent(type=EventType.TOOL_START, data={"name": item.get("name", "tool"), "input": item.get("input")})
            if item_type == "tool_result":
                return LLMEvent(type=EventType.TOOL_RESULT, data={"content": item.get("output")})
            # Skip reasoning items silently
            return None

        # Skip lifecycle events (thread.started, turn.started, turn.completed, item.started)
        if event_type in ("thread.started", "turn.started", "turn.completed", "item.started"):
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
