"""
Authentication helpers for Auto Codex.

Provides centralized authentication token resolution with back-compat warnings
for legacy LLM OAuth tokens, plus SDK environment variable passthrough.
"""

import os
import re
import json
from dataclasses import dataclass
from typing import Optional

from .debug import debug, debug_success, debug_warning

# Priority order for auth token resolution.
#
# Auto Codex primarily targets Codex CLI. Authentication can come from:
# - OPENAI_API_KEY (API key auth)
# - CODEX_CODE_OAUTH_TOKEN (desktop/profile OAuth token)
# - CODEX_CONFIG_DIR (Codex CLI config directory with credentials)
#
# Some call sites still refer to this as a "token"; for config-dir based
# authentication we return the config-dir string as a truthy marker.
AUTH_TOKEN_ENV_VARS = ["OPENAI_API_KEY", "CODEX_CODE_OAUTH_TOKEN", "CODEX_CONFIG_DIR"]

# Legacy environment variables that should be migrated
DEPRECATED_AUTH_ENV_VARS = [
    "CLAUDE_CODE_OAUTH_TOKEN",
]

# Environment variables to pass through to SDK subprocess
SDK_ENV_VARS = [
    "OPENAI_API_KEY",
    "CODEX_CODE_OAUTH_TOKEN",
    "CODEX_CONFIG_DIR",
    "OPENAI_BASE_URL",
    "OPENAI_API_BASE",
    "NO_PROXY",
    "DISABLE_TELEMETRY",
    "DISABLE_COST_WARNINGS",
    "API_TIMEOUT_MS",
]

_OPENAI_KEY_PATTERN = re.compile(r"^sk-[A-Za-z0-9-]{20,}$")
_DEFAULT_CODEX_CONFIG_DIR = os.path.expanduser("~/.codex")


@dataclass
class AuthStatus:
    """Authentication status for health checks and startup verification."""
    is_authenticated: bool
    source: Optional[str]  # "auth.json", "env", "config_dir", "default_config_dir"
    api_key_set: bool
    base_url_set: bool
    config_dir: Optional[str]
    codex_cli_available: bool = False
    codex_cli_path: Optional[str] = None
    errors: list[str] = None  # type: ignore[assignment]

    def __post_init__(self) -> None:
        if self.errors is None:
            self.errors = []

    def __str__(self) -> str:
        if self.is_authenticated:
            return f"Authenticated via {self.source}"
        return f"Not authenticated: {', '.join(self.errors) if self.errors else 'unknown reason'}"


def _read_codex_auth_json(config_dir: str) -> dict[str, object] | None:
    """
    Read a Codex CLI `auth.json` file from a config directory.

    Third-party activators/gateways commonly store OpenAI-compatible API keys and
    base URLs here (e.g. `OPENAI_API_KEY`, `api_base_url`).
    """
    try:
        auth_path = os.path.join(config_dir, "auth.json")
        if not os.path.isfile(auth_path):
            return None
        with open(auth_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else None
    except Exception:
        return None


def _hydrate_env_from_codex_auth_json() -> None:
    """
    Populate process env from Codex CLI config when GUI apps don't inherit shell env.

    - If OPENAI_API_KEY is missing, try to load it from `CODEX_CONFIG_DIR/auth.json`
      (or the default `~/.codex/auth.json`).
    - If a gateway base URL is present (`api_base_url`), map it to OPENAI_BASE_URL /
      OPENAI_API_BASE for OpenAI-compatible SDKs.
    """
    # Never override explicit env vars.
    if (os.environ.get("OPENAI_API_KEY") or "").strip() and (os.environ.get("OPENAI_BASE_URL") or "").strip():
        return

    config_dir = (os.environ.get("CODEX_CONFIG_DIR") or "").strip()
    if not config_dir:
        if os.environ.get("AUTO_CODEX_DISABLE_DEFAULT_CODEX_CONFIG_DIR", "").strip():
            return
        config_dir = _DEFAULT_CODEX_CONFIG_DIR
    if not os.path.isdir(config_dir):
        return

    auth = _read_codex_auth_json(config_dir)
    if not auth:
        return

    if (os.environ.get("CODEX_CODE_OAUTH_TOKEN") or "").strip():
        return

    if not (os.environ.get("OPENAI_API_KEY") or "").strip():
        key = auth.get("OPENAI_API_KEY") or auth.get("api_key") or auth.get("apiKey") or auth.get("key") or auth.get("token")
        if isinstance(key, str) and key.strip():
            os.environ["OPENAI_API_KEY"] = key.strip()

    base_url = auth.get("api_base_url")
    if isinstance(base_url, str) and base_url.strip():
        if not (os.environ.get("OPENAI_BASE_URL") or "").strip():
            os.environ["OPENAI_BASE_URL"] = base_url.strip()
        if not (os.environ.get("OPENAI_API_BASE") or "").strip():
            os.environ["OPENAI_API_BASE"] = base_url.strip()


def ensure_auth_hydrated() -> AuthStatus:
    """
    Ensure authentication credentials are loaded and return status information.

    This function wraps _hydrate_env_from_codex_auth_json() and provides:
    - Logging of authentication source for debugging
    - AuthStatus dataclass with detailed authentication state

    Should be called at the start of any runner (Insights, Roadmap, Ideation)
    to ensure credentials are loaded regardless of launch method (terminal or GUI).

    Returns:
        AuthStatus with authentication state and source information
    """
    errors: list[str] = []
    checked_sources: list[str] = []

    # Track state before hydration
    had_api_key_before = bool((os.environ.get("OPENAI_API_KEY") or "").strip())
    had_base_url_before = bool((os.environ.get("OPENAI_BASE_URL") or "").strip())

    # Perform hydration
    _hydrate_env_from_codex_auth_json()

    # Check authentication state after hydration
    api_key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    base_url = (os.environ.get("OPENAI_BASE_URL") or "").strip()
    oauth_token = (os.environ.get("CODEX_CODE_OAUTH_TOKEN") or "").strip()
    config_dir_env = (os.environ.get("CODEX_CONFIG_DIR") or "").strip()

    # Determine authentication source
    source: Optional[str] = None
    config_dir_used: Optional[str] = None

    if api_key and is_valid_openai_api_key(api_key):
        if had_api_key_before:
            source = "env"
            debug("auth", "Using OPENAI_API_KEY from environment variable")
        else:
            # Key was loaded from auth.json
            config_dir_used = config_dir_env if config_dir_env else _DEFAULT_CODEX_CONFIG_DIR
            source = "auth.json"
            debug_success("auth", f"Loaded credentials from {config_dir_used}/auth.json")
        checked_sources.append("OPENAI_API_KEY")
    elif oauth_token and is_valid_codex_oauth_token(oauth_token):
        source = "env"
        debug("auth", "Using CODEX_CODE_OAUTH_TOKEN from environment variable")
        checked_sources.append("CODEX_CODE_OAUTH_TOKEN")
    elif config_dir_env and is_valid_codex_config_dir(config_dir_env):
        source = "config_dir"
        config_dir_used = config_dir_env
        debug("auth", f"Using CODEX_CONFIG_DIR: {config_dir_env}")
        checked_sources.append("CODEX_CONFIG_DIR")
    elif has_default_codex_config_dir():
        source = "default_config_dir"
        config_dir_used = _DEFAULT_CODEX_CONFIG_DIR
        debug("auth", f"Using default Codex config directory: {_DEFAULT_CODEX_CONFIG_DIR}")
        checked_sources.append("~/.codex")
    else:
        # No authentication found
        checked_sources.extend([
            "OPENAI_API_KEY (env)",
            "CODEX_CODE_OAUTH_TOKEN (env)",
            "CODEX_CONFIG_DIR (env)",
            f"~/.codex/auth.json",
            f"~/.codex/config.toml",
        ])
        errors.append("No valid authentication credentials found")
        debug_warning("auth", "No authentication credentials found", checked_sources=checked_sources)

    is_authenticated = source is not None

    status = AuthStatus(
        is_authenticated=is_authenticated,
        source=source,
        api_key_set=bool(api_key),
        base_url_set=bool(base_url),
        config_dir=config_dir_used,
        errors=errors,
    )

    if is_authenticated:
        debug("auth", f"Authentication status: {status}", source=source, api_key_set=status.api_key_set, base_url_set=status.base_url_set)

    return status


def _find_codex_cli_path() -> str | None:
    """
    Find the codex CLI executable path.

    First tries shutil.which (works in terminal), then falls back to
    common installation paths (needed for GUI apps launched from Finder).
    """
    import shutil

    # Common codex installation paths (for GUI apps that don't inherit shell PATH)
    codex_search_paths = [
        "/opt/homebrew/bin/codex",  # macOS ARM (Homebrew)
        "/usr/local/bin/codex",     # macOS Intel (Homebrew) / Linux
        "/usr/bin/codex",           # System-wide Linux
        os.path.expanduser("~/.local/bin/codex"),  # User-local
        os.path.expanduser("~/.npm-global/bin/codex"),  # npm global
    ]

    # Try PATH first (works in terminal)
    codex_path = shutil.which("codex")
    if codex_path:
        return codex_path

    # Fallback: check common installation paths
    for path in codex_search_paths:
        if os.path.isfile(path) and os.access(path, os.X_OK):
            return path

    return None


def check_auth_health() -> AuthStatus:
    """
    Perform a comprehensive health check of authentication status.

    This function:
    1. Ensures credentials are loaded via _hydrate_env_from_codex_auth_json()
    2. Checks authentication status and source
    3. Checks Codex CLI availability and path

    Returns:
        AuthStatus with complete authentication and CLI status information

    Example:
        >>> status = check_auth_health()
        >>> if status.is_authenticated and status.codex_cli_available:
        ...     print(f"Ready to use Codex via {status.source}")
        ... else:
        ...     print(f"Issues: {status.errors}")
    """
    # Get base authentication status
    status = ensure_auth_hydrated()

    # Check Codex CLI availability
    codex_path = _find_codex_cli_path()
    status.codex_cli_available = codex_path is not None
    status.codex_cli_path = codex_path

    if not status.codex_cli_available:
        status.errors.append("Codex CLI not found in PATH or common installation locations")
        debug_warning("auth", "Codex CLI not found", searched_paths=[
            "PATH",
            "/opt/homebrew/bin/codex",
            "/usr/local/bin/codex",
            "/usr/bin/codex",
            "~/.local/bin/codex",
            "~/.npm-global/bin/codex",
        ])
    else:
        debug_success("auth", f"Codex CLI found at {codex_path}")

    return status


def _looks_like_api_key(token: str) -> bool:
    """
    Heuristic for API keys that aren't in the canonical `sk-...` format.

    Some Codex-compatible third-party providers issue keys that do not start with `sk-`
    (e.g. gateway/proxy keys). We treat these as valid if they are non-empty, contain
    no whitespace, and have a reasonable minimum length.
    """
    t = (token or "").strip()
    return bool(t) and (len(t) >= 20) and not any(c.isspace() for c in t)


def is_valid_openai_api_key(token: str) -> bool:
    """
    Return True if the token looks like an API key.

    Accepts canonical OpenAI keys (`sk-...`) and also non-`sk-` keys used by
    third-party Codex gateways.
    """
    t = (token or "").strip()
    return bool(_OPENAI_KEY_PATTERN.match(t)) or _looks_like_api_key(t)


def is_valid_codex_oauth_token(token: str) -> bool:
    """
    Return True if the token is plausibly a Codex OAuth token.

    Codex OAuth tokens do not share the OPENAI_API_KEY "sk-..." pattern, so we
    apply a conservative sanity check (non-empty, no whitespace, reasonable length).
    """
    t = (token or "").strip()
    return bool(t) and (len(t) >= 20) and not any(c.isspace() for c in t)


def is_valid_codex_config_dir(config_dir: str) -> bool:
    """Return True if CODEX_CONFIG_DIR points to an existing directory."""
    p = (config_dir or "").strip()
    return bool(p) and os.path.isdir(p)


def has_default_codex_config_dir() -> bool:
    """
    Return True if the default Codex CLI config dir (~/.codex) looks usable.

    This supports setups where Codex CLI auth is configured via its default
    on-disk config (e.g. third-party provider profiles) without exporting env vars.
    """
    if os.environ.get("AUTO_CODEX_DISABLE_DEFAULT_CODEX_CONFIG_DIR", "").strip():
        return False
    if not os.path.isdir(_DEFAULT_CODEX_CONFIG_DIR):
        return False
    return os.path.isfile(os.path.join(_DEFAULT_CODEX_CONFIG_DIR, "config.toml")) or os.path.isfile(
        os.path.join(_DEFAULT_CODEX_CONFIG_DIR, "auth.json")
    )


def get_deprecated_auth_token() -> str | None:
    """Return the legacy LLM OAuth token if present (deprecated)."""
    for var in DEPRECATED_AUTH_ENV_VARS:
        token = os.environ.get(var)
        if token:
            return token
    return None


def get_auth_token() -> str | None:
    """
    Get authentication token from environment variables.

    Checks sources in priority order:
    1. OPENAI_API_KEY (env var, validated)
    2. CODEX_CODE_OAUTH_TOKEN (env var)
    3. CODEX_CONFIG_DIR (env var, directory existence)

    Returns:
        Token string if found, None otherwise
    """
    _hydrate_env_from_codex_auth_json()

    openai_token = os.environ.get("OPENAI_API_KEY", "")
    if openai_token and is_valid_openai_api_key(openai_token):
        return openai_token.strip()

    oauth_token = os.environ.get("CODEX_CODE_OAUTH_TOKEN", "")
    if oauth_token and is_valid_codex_oauth_token(oauth_token):
        return oauth_token.strip()

    config_dir = os.environ.get("CODEX_CONFIG_DIR", "")
    if config_dir and is_valid_codex_config_dir(config_dir):
        return config_dir.strip()

    if has_default_codex_config_dir():
        return _DEFAULT_CODEX_CONFIG_DIR

    return None


def get_auth_token_source() -> str | None:
    """Get the name of the source that provided the auth token."""
    _hydrate_env_from_codex_auth_json()

    openai_token = os.environ.get("OPENAI_API_KEY", "")
    if openai_token and is_valid_openai_api_key(openai_token):
        return "OPENAI_API_KEY"

    oauth_token = os.environ.get("CODEX_CODE_OAUTH_TOKEN", "")
    if oauth_token and is_valid_codex_oauth_token(oauth_token):
        return "CODEX_CODE_OAUTH_TOKEN"

    config_dir = os.environ.get("CODEX_CONFIG_DIR", "")
    if config_dir and is_valid_codex_config_dir(config_dir):
        return "CODEX_CONFIG_DIR"

    if has_default_codex_config_dir():
        return "DEFAULT_CODEX_CONFIG_DIR"

    return None


def require_auth_token() -> str:
    """
    Get authentication token or raise ValueError.

    Raises:
        ValueError: If no auth token is found in any supported source
    """
    _hydrate_env_from_codex_auth_json()

    token = get_auth_token()
    if token:
        return token

    openai_token = os.environ.get("OPENAI_API_KEY", "")
    if openai_token and not is_valid_openai_api_key(openai_token):
        raise ValueError(
            "Invalid OPENAI_API_KEY format.\n"
            "Expected a non-empty key without whitespace (OpenAI keys often start with 'sk-')."
        )

    oauth_token = os.environ.get("CODEX_CODE_OAUTH_TOKEN", "")
    if oauth_token and not is_valid_codex_oauth_token(oauth_token):
        raise ValueError(
            "Invalid CODEX_CODE_OAUTH_TOKEN format.\n"
            "Expected a non-empty token without whitespace."
        )

    config_dir = os.environ.get("CODEX_CONFIG_DIR", "")
    if config_dir and not is_valid_codex_config_dir(config_dir):
        raise ValueError(
            "Invalid CODEX_CONFIG_DIR.\n"
            f"Directory does not exist: {config_dir}"
        )

    if has_default_codex_config_dir():
        return _DEFAULT_CODEX_CONFIG_DIR

    deprecated_token = get_deprecated_auth_token()
    if deprecated_token:
        raise ValueError(
            "Detected deprecated CLAUDE_CODE_OAUTH_TOKEN.\n"
            "Please migrate to one of:\n"
            "- OPENAI_API_KEY (API key)\n"
            "- CODEX_CODE_OAUTH_TOKEN (OAuth token)\n"
            "- CODEX_CONFIG_DIR (Codex config directory)\n"
            "Then remove CLAUDE_CODE_OAUTH_TOKEN."
        )

    raise ValueError(
        "No Codex authentication found.\n\n"
        "Configure one of:\n"
        "- OPENAI_API_KEY (API key)\n"
        "- CODEX_CODE_OAUTH_TOKEN (OAuth token)\n"
        "- CODEX_CONFIG_DIR (Codex config directory)\n\n"
        "In Auto Codex Desktop: Settings > Codex Profiles."
    )


def get_sdk_env_vars() -> dict[str, str]:
    """
    Get environment variables to pass to SDK.

    Collects relevant env vars that should be passed through to subprocesses.

    Returns:
        Dict of env var name -> value for non-empty vars
    """
    env = {}
    for var in SDK_ENV_VARS:
        value = os.environ.get(var)
        if value:
            env[var] = value
    return env


def ensure_openai_api_key() -> None:
    """Ensure Codex authentication is configured, raising a helpful error if not."""
    require_auth_token()


def ensure_claude_code_oauth_token() -> None:
    """
    Deprecated shim for legacy call sites.

    Ensures Codex authentication is configured, and raises a helpful error if not.
    """
    ensure_openai_api_key()
