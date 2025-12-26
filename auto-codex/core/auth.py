"""
Authentication helpers for Auto Codex.

Provides centralized authentication token resolution with back-compat warnings
for legacy LLM OAuth tokens, plus SDK environment variable passthrough.
"""

import json
import os
import re
from dataclasses import dataclass

from .debug import debug, debug_success, debug_warning

try:
    import tomllib
except ImportError:  # pragma: no cover - fallback for older environments
    import tomli as tomllib

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
    source: str | None  # "auth.json", "env", "config_dir", "default_config_dir"
    api_key_set: bool
    base_url_set: bool
    config_dir: str | None
    codex_cli_available: bool = False
    codex_cli_path: str | None = None
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
        debug("auth", "Attempting to read Codex auth.json", path=auth_path)
        if not os.path.isfile(auth_path):
            debug_warning("auth", "Codex auth.json not found", path=auth_path)
            return None
        with open(auth_path, encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            debug_success("auth", "Loaded Codex auth.json", path=auth_path)
            return data
        debug_warning("auth", "Codex auth.json is not a dict", path=auth_path)
        return None
    except Exception as exc:
        debug_warning("auth", "Failed to read Codex auth.json", error=str(exc))
        return None


def _read_codex_config_toml(config_dir: str) -> dict[str, object] | None:
    """
    Read Codex CLI config.toml from a config directory.

    Third-party providers (e.g., yunyi) store credentials here:
    - model_provider: provider name
    - model_providers.<name>.base_url: API base URL
    - model_providers.<name>.experimental_bearer_token: auth token
    """
    try:
        config_path = os.path.join(config_dir, "config.toml")
        debug("auth", "Attempting to read Codex config.toml", path=config_path)
        if not os.path.isfile(config_path):
            debug_warning("auth", "Codex config.toml not found", path=config_path)
            return None
        with open(config_path, "rb") as f:
            data = tomllib.load(f)
        if isinstance(data, dict):
            debug_success("auth", "Loaded Codex config.toml", path=config_path)
            return data
        debug_warning("auth", "Codex config.toml is not a dict", path=config_path)
        return None
    except Exception as exc:
        debug_warning("auth", "Failed to read Codex config.toml", error=str(exc))
        return None


def _hydrate_env_from_codex_config() -> None:
    """
    Populate process env from Codex CLI config when GUI apps don't inherit shell env.

    - If OPENAI_API_KEY is missing, try to load it from `CODEX_CONFIG_DIR/auth.json`
      (or the default `~/.codex/auth.json`).
    - If auth.json is missing or incomplete, try to load from `config.toml` provider profile.
    - If a gateway base URL is present (`api_base_url`), map it to OPENAI_BASE_URL /
      OPENAI_API_BASE for OpenAI-compatible SDKs.
    """
    debug("auth", "Hydrating environment from Codex config")
    # Never override explicit env vars.
    if (os.environ.get("OPENAI_API_KEY") or "").strip() and (os.environ.get("OPENAI_BASE_URL") or "").strip():
        debug("auth", "OPENAI_API_KEY and OPENAI_BASE_URL already set; skipping hydration")
        return

    config_dir = (os.environ.get("CODEX_CONFIG_DIR") or "").strip()
    if not config_dir:
        if os.environ.get("AUTO_CODEX_DISABLE_DEFAULT_CODEX_CONFIG_DIR", "").strip():
            debug("auth", "Default Codex config dir disabled by env")
            return
        config_dir = _DEFAULT_CODEX_CONFIG_DIR
    debug("auth", "Using Codex config directory", config_dir=config_dir)
    if not os.path.isdir(config_dir):
        debug_warning("auth", "Codex config directory not found", config_dir=config_dir)
        return

    auth = _read_codex_auth_json(config_dir)
    if not auth:
        debug_warning("auth", "auth.json not found or unreadable", config_dir=config_dir)
    config = _read_codex_config_toml(config_dir)
    if not config:
        debug_warning("auth", "config.toml not found or unreadable", config_dir=config_dir)

    if (os.environ.get("CODEX_CODE_OAUTH_TOKEN") or "").strip():
        debug("auth", "CODEX_CODE_OAUTH_TOKEN already set; skipping config hydration")
        return

    if not (os.environ.get("OPENAI_API_KEY") or "").strip():
        key = None
        key_source = None
        if auth:
            key = auth.get("OPENAI_API_KEY") or auth.get("api_key") or auth.get("apiKey") or auth.get("key") or auth.get("token")
            if isinstance(key, str) and key.strip():
                key_source = "auth.json"
        if not key_source:
            provider_name = config.get("model_provider") if isinstance(config, dict) else None
            providers = config.get("model_providers") if isinstance(config, dict) else None
            provider = providers.get(provider_name) if isinstance(providers, dict) and isinstance(provider_name, str) else None
            if isinstance(provider, dict):
                key = provider.get("experimental_bearer_token")
                if isinstance(key, str) and key.strip():
                    key_source = "config.toml"
        if isinstance(key, str) and key.strip():
            os.environ["OPENAI_API_KEY"] = key.strip()
            debug_success("auth", "Loaded OPENAI_API_KEY", source=key_source, config_dir=config_dir)
        else:
            debug_warning("auth", "No OPENAI_API_KEY found in auth.json or config.toml", config_dir=config_dir)

    base_url = auth.get("api_base_url") if auth else None
    base_url_source = "auth.json" if base_url else None
    if not base_url:
        provider_name = config.get("model_provider") if isinstance(config, dict) else None
        providers = config.get("model_providers") if isinstance(config, dict) else None
        provider = providers.get(provider_name) if isinstance(providers, dict) and isinstance(provider_name, str) else None
        if isinstance(provider, dict):
            base_url = provider.get("base_url")
            if isinstance(base_url, str) and base_url.strip():
                base_url_source = "config.toml"
    if isinstance(base_url, str) and base_url.strip():
        if not (os.environ.get("OPENAI_BASE_URL") or "").strip():
            os.environ["OPENAI_BASE_URL"] = base_url.strip()
            debug_success("auth", "Loaded OPENAI_BASE_URL", source=base_url_source, config_dir=config_dir)
        if not (os.environ.get("OPENAI_API_BASE") or "").strip():
            os.environ["OPENAI_API_BASE"] = base_url.strip()
            debug_success("auth", "Loaded OPENAI_API_BASE", source=base_url_source, config_dir=config_dir)
    else:
        debug_warning("auth", "No base_url found in auth.json or config.toml", config_dir=config_dir)


def ensure_auth_hydrated() -> AuthStatus:
    """
    Ensure authentication credentials are loaded and return status information.

    This function wraps _hydrate_env_from_codex_config() and provides:
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
    _hydrate_env_from_codex_config()

    # Check authentication state after hydration
    api_key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    base_url = (os.environ.get("OPENAI_BASE_URL") or "").strip()
    oauth_token = (os.environ.get("CODEX_CODE_OAUTH_TOKEN") or "").strip()
    config_dir_env = (os.environ.get("CODEX_CONFIG_DIR") or "").strip()

    # Determine authentication source
    source: str | None = None
    config_dir_used: str | None = None

    if api_key and is_valid_openai_api_key(api_key):
        if had_api_key_before:
            source = "env"
            debug("auth", "Using OPENAI_API_KEY from environment variable")
        else:
            config_dir_used = config_dir_env if config_dir_env else _DEFAULT_CODEX_CONFIG_DIR
            auth = _read_codex_auth_json(config_dir_used)
            if auth:
                auth_key = auth.get("OPENAI_API_KEY") or auth.get("api_key") or auth.get("apiKey") or auth.get("key") or auth.get("token")
            else:
                auth_key = None
            config = _read_codex_config_toml(config_dir_used)
            provider_name = config.get("model_provider") if isinstance(config, dict) else None
            providers = config.get("model_providers") if isinstance(config, dict) else None
            provider = providers.get(provider_name) if isinstance(providers, dict) and isinstance(provider_name, str) else None
            config_key = provider.get("experimental_bearer_token") if isinstance(provider, dict) else None
            if isinstance(auth_key, str) and auth_key.strip() == api_key:
                source = "auth.json"
            elif isinstance(config_key, str) and config_key.strip() == api_key:
                source = "config.toml"
            else:
                source = "config_dir"
            debug_success("auth", f"Loaded credentials from {config_dir_used}", source=source)
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
            "~/.codex/auth.json",
            "~/.codex/config.toml",
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
    1. Ensures credentials are loaded via _hydrate_env_from_codex_config()
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
    auth_path = os.path.join(_DEFAULT_CODEX_CONFIG_DIR, "auth.json")
    if os.path.isfile(auth_path):
        return True
    config = _read_codex_config_toml(_DEFAULT_CODEX_CONFIG_DIR)
    if not isinstance(config, dict):
        return False
    provider_name = config.get("model_provider")
    providers = config.get("model_providers")
    if not isinstance(provider_name, str) or not provider_name.strip():
        return False
    if not isinstance(providers, dict):
        return False
    provider = providers.get(provider_name)
    if not isinstance(provider, dict):
        return False
    base_url = provider.get("base_url")
    token = provider.get("experimental_bearer_token")
    return bool(
        (isinstance(base_url, str) and base_url.strip())
        or (isinstance(token, str) and token.strip())
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
    _hydrate_env_from_codex_config()

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
    _hydrate_env_from_codex_config()

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
    _hydrate_env_from_codex_config()

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
