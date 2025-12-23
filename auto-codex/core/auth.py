"""
Authentication helpers for Auto Codex.

Provides centralized authentication token resolution with back-compat warnings
for legacy LLM OAuth tokens, plus SDK environment variable passthrough.
"""

import os
import re
import json

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

    config_dir = (os.environ.get("CODEX_CONFIG_DIR") or "").strip() or _DEFAULT_CODEX_CONFIG_DIR
    if not os.path.isdir(config_dir):
        return

    auth = _read_codex_auth_json(config_dir)
    if not auth:
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
