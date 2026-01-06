#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

failures=0
warnings=0

log_ok() {
  echo "[ok] $*"
}

log_warn() {
  warnings=$((warnings + 1))
  echo "[warn] $*"
}

log_fail() {
  failures=$((failures + 1))
  echo "[fail] $*"
}

check_cmd() {
  local cmd="$1"
  local label="${2:-$1}"
  if command -v "$cmd" >/dev/null 2>&1; then
    log_ok "$label found"
    return 0
  fi
  log_fail "$label not found"
  return 1
}

get_env_value() {
  local key="$1"
  local file="$2"
  if [[ ! -f "$file" ]]; then
    return 1
  fi
  local line
  line="$(grep -E "^[[:space:]]*${key}[[:space:]]*=" "$file" | tail -n 1 || true)"
  if [[ -z "$line" ]]; then
    return 1
  fi
  local value="${line#*=}"
  value="${value%%#*}"
  value="$(echo "$value" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")"
  if [[ -n "$value" ]]; then
    printf "%s" "$value"
    return 0
  fi
  return 1
}

is_true() {
  case "${1:-}" in
    [Tt][Rr][Uu][Ee]|1|[Yy][Ee][Ss]|[Oo][Nn]) return 0 ;;
    *) return 1 ;;
  esac
}

check_python() {
  if ! command -v python3 >/dev/null 2>&1; then
    log_fail "python3 not found"
    return
  fi
  local version
  version="$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:3])))')"
  if python3 -c 'import sys; raise SystemExit(0 if sys.version_info >= (3,12) else 1)'; then
    log_ok "python3 $version"
  else
    log_fail "python3 >= 3.12 required (found $version)"
  fi
}

check_node() {
  if ! command -v node >/dev/null 2>&1; then
    log_fail "node not found (required for auto-codex-ui)"
    return
  fi
  local version raw major
  raw="$(node -v 2>/dev/null | sed 's/^v//')"
  major="${raw%%.*}"
  if [[ -n "$major" && "$major" -ge 18 ]]; then
    log_ok "node $raw"
  else
    log_fail "node >= 18 required (found ${raw:-unknown})"
  fi
}

check_git_repo() {
  if [[ -d "$ROOT_DIR/.git" ]]; then
    log_ok "git repo detected"
  else
    log_fail "git repo not found at $ROOT_DIR"
  fi
}

check_git_clean() {
  if ! command -v git >/dev/null 2>&1; then
    return
  fi
  if ! git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    return
  fi
  local status count
  status="$(git -C "$ROOT_DIR" status --porcelain)"
  if [[ -n "$status" ]]; then
    count="$(printf "%s\n" "$status" | wc -l | tr -d ' ')"
    local production="${AUTO_CODEX_PRODUCTION:-}"
    local enforce_clean="${AUTO_CODEX_ENFORCE_CLEAN_GIT:-}"
    if is_true "$production" || is_true "$enforce_clean"; then
      log_fail "git working tree dirty (${count} change(s))"
    else
      log_warn "git working tree dirty (${count} change(s))"
    fi
    return
  fi
  log_ok "git working tree clean"
}

check_file() {
  local file="$1"
  local label="${2:-$1}"
  if [[ -f "$file" ]]; then
    log_ok "$label present"
    return 0
  fi
  log_warn "$label missing"
  return 1
}

check_auth() {
  # Use Python health check for comprehensive auth verification
  # Graphiti config validation relies on env vars from auto-codex/.env or repo .env.
  # Ensure provider credentials (OPENAI_API_KEY/ANTHROPIC_API_KEY/AZURE_OPENAI_*/VOYAGE_API_KEY/GOOGLE_API_KEY/OLLAMA_*)
  # and FalkorDB settings are available when GRAPHITI_ENABLED=true.
  local python_output python_exit_code
  python_output=$(python3 -c "
import sys
sys.path.insert(0, '$ROOT_DIR/auto-codex')
from core.auth import check_auth_health

status = check_auth_health()

# Print auth source
if status.is_authenticated:
    print(f'AUTH_SOURCE={status.source}')
    if status.config_dir:
        print(f'CONFIG_DIR={status.config_dir}')
else:
    print('AUTH_SOURCE=')

# Print CLI status
if status.codex_cli_available:
    print(f'CLI_PATH={status.codex_cli_path}')
else:
    print('CLI_PATH=')

# Print errors
if status.errors:
    print(f'ERRORS={\"|\".join(status.errors)}')
else:
    print('ERRORS=')
" 2>&1) || true
  python_exit_code=$?

  if [[ -n "$python_output" ]] && echo "$python_output" | grep -q '^AUTH_SOURCE='; then
    local auth_source cli_path errors config_dir
    auth_source=$(echo "$python_output" | grep '^AUTH_SOURCE=' | cut -d= -f2- || true)
    config_dir=$(echo "$python_output" | grep '^CONFIG_DIR=' | cut -d= -f2- || true)
    cli_path=$(echo "$python_output" | grep '^CLI_PATH=' | cut -d= -f2- || true)
    errors=$(echo "$python_output" | grep '^ERRORS=' | cut -d= -f2- || true)

    if [[ -n "$auth_source" ]]; then
      if [[ -n "$config_dir" ]]; then
        log_ok "Codex auth source: $auth_source ($config_dir)"
      else
        log_ok "Codex auth source: $auth_source"
      fi
    else
      log_fail "Codex auth not found (set OPENAI_API_KEY/CODEX_CODE_OAUTH_TOKEN/CODEX_CONFIG_DIR)"
    fi

    if [[ -n "$cli_path" ]]; then
      log_ok "Codex CLI: $cli_path"
    else
      log_fail "Codex CLI not found"
    fi
  else
    # Fallback to shell-based check if Python fails
    local auth_source=""
    if [[ -n "${OPENAI_API_KEY:-}" ]]; then
      auth_source="OPENAI_API_KEY (env)"
    elif [[ -n "${CODEX_CODE_OAUTH_TOKEN:-}" ]]; then
      auth_source="CODEX_CODE_OAUTH_TOKEN (env)"
    elif [[ -n "${CODEX_CONFIG_DIR:-}" ]]; then
      auth_source="CODEX_CONFIG_DIR (env)"
    fi

    if [[ -z "$auth_source" ]]; then
      local env_file="$ROOT_DIR/auto-codex/.env"
      if get_env_value "OPENAI_API_KEY" "$env_file" >/dev/null; then
        auth_source="OPENAI_API_KEY (auto-codex/.env)"
      elif get_env_value "CODEX_CODE_OAUTH_TOKEN" "$env_file" >/dev/null; then
        auth_source="CODEX_CODE_OAUTH_TOKEN (auto-codex/.env)"
      elif get_env_value "CODEX_CONFIG_DIR" "$env_file" >/dev/null; then
        auth_source="CODEX_CONFIG_DIR (auto-codex/.env)"
      fi
    fi

    if [[ -z "$auth_source" ]]; then
      local codex_dir="$HOME/.codex"
      if [[ -z "${AUTO_CODEX_DISABLE_DEFAULT_CODEX_CONFIG_DIR:-}" ]] && [[ -f "$codex_dir/config.toml" || -f "$codex_dir/auth.json" ]]; then
        auth_source="DEFAULT_CODEX_CONFIG_DIR (~/.codex)"
      fi
    fi

    if [[ -n "$auth_source" ]]; then
      log_ok "Codex auth source: $auth_source"
    else
      log_fail "Codex auth not found (set OPENAI_API_KEY/CODEX_CODE_OAUTH_TOKEN/CODEX_CONFIG_DIR)"
    fi
  fi
}

check_sandbox() {
  local bypass="${AUTO_CODEX_BYPASS_CODEX_SANDBOX:-}"
  if [[ -z "$bypass" ]]; then
    bypass="$(get_env_value "AUTO_CODEX_BYPASS_CODEX_SANDBOX" "$ROOT_DIR/auto-codex/.env" || true)"
  fi

  local enforce="${AUTO_CODEX_ENFORCE_SANDBOX:-}"
  if is_true "$enforce"; then
    if [[ "$bypass" == "0" || -z "$bypass" ]]; then
      log_ok "Codex CLI sandbox enforced"
    else
      log_fail "Codex CLI sandbox must be enforced (set AUTO_CODEX_BYPASS_CODEX_SANDBOX=0)"
    fi
    return
  fi

  if [[ -z "$bypass" ]]; then
    log_ok "Codex CLI sandbox enforced by default (AUTO_CODEX_BYPASS_CODEX_SANDBOX not set)"
    return
  fi

  if [[ "$bypass" == "0" ]]; then
    log_ok "Codex CLI sandbox enforced (AUTO_CODEX_BYPASS_CODEX_SANDBOX=0)"
  else
    log_warn "Codex CLI sandbox bypass enabled (AUTO_CODEX_BYPASS_CODEX_SANDBOX=$bypass)"
  fi
}

detect_compose_cmd() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    echo "docker compose"
    return 0
  fi
  if command -v docker-compose >/dev/null 2>&1 && docker-compose version >/dev/null 2>&1; then
    echo "docker-compose"
    return 0
  fi
  return 1
}

check_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    log_fail "docker not found"
    return 1
  fi
  if ! docker info >/dev/null 2>&1; then
    log_fail "docker daemon not running"
    return 1
  fi
  log_ok "docker available"
  return 0
}

check_graphiti() {
  local graphiti_enabled="${GRAPHITI_ENABLED:-}"
  if [[ -z "$graphiti_enabled" ]]; then
    graphiti_enabled="$(get_env_value "GRAPHITI_ENABLED" "$ROOT_DIR/auto-codex/.env" || true)"
  fi

  if is_true "$graphiti_enabled"; then
    log_ok "Graphiti enabled"
  else
    log_ok "Graphiti disabled"
    return
  fi

  local python_output python_exit_code
  set +e
  python_output=$(GRAPHITI_ENABLED="$graphiti_enabled" python3 - <<PY
import os
import sys
from pathlib import Path

root = Path(r"$ROOT_DIR")

def load_env(path: Path) -> None:
    if not path.exists():
        return
    try:
        content = path.read_text(encoding="utf-8")
    except OSError:
        return
    for raw in content.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if not key:
            continue
        if value and value[0] in ("'", '"') and value[-1] == value[0]:
            value = value[1:-1]
        else:
            if "#" in value:
                value = value.split("#", 1)[0].rstrip()
        os.environ.setdefault(key, value)

load_env(root / "auto-codex" / ".env")
load_env(root / ".env")

sys.path.insert(0, str(root / "auto-codex"))
try:
    from graphiti_config import validate_graphiti_config
except Exception as exc:
    print(f"GRAPHITI_CONFIG_ERRORS=Healthcheck failed to load Graphiti config: {exc}")
    raise SystemExit(1)

ok, errors = validate_graphiti_config()
if ok:
    print("GRAPHITI_CONFIG_OK=1")
else:
    print("GRAPHITI_CONFIG_ERRORS=" + "|".join(errors))
    raise SystemExit(1)
PY
  )
  python_exit_code=$?
  set -e

  if [[ "$python_exit_code" -ne 0 ]]; then
    local config_errors
    config_errors="$(echo "$python_output" | grep '^GRAPHITI_CONFIG_ERRORS=' | cut -d= -f2- || true)"
    if [[ -n "$config_errors" ]]; then
      log_fail "Graphiti config invalid: $config_errors"
    else
      log_fail "Graphiti config validation failed"
    fi
  else
    log_ok "Graphiti config valid"
  fi

  if ! check_docker; then
    return
  fi

  local compose_cmd
  if compose_cmd="$(detect_compose_cmd)"; then
    log_ok "compose command: $compose_cmd"
  else
    log_fail "docker compose/docker-compose not found"
  fi

  local falkor_tag="${FALKORDB_IMAGE_TAG:-}"
  local mcp_tag="${GRAPHITI_MCP_IMAGE_TAG:-}"
  if [[ -z "$falkor_tag" ]]; then
    falkor_tag="$(get_env_value "FALKORDB_IMAGE_TAG" "$ROOT_DIR/.env" || true)"
  fi
  if [[ -z "$mcp_tag" ]]; then
    mcp_tag="$(get_env_value "GRAPHITI_MCP_IMAGE_TAG" "$ROOT_DIR/.env" || true)"
  fi

  if [[ -n "$falkor_tag" ]]; then
    log_ok "FALKORDB_IMAGE_TAG set"
  else
    log_fail "FALKORDB_IMAGE_TAG not set (required for production)"
  fi
  if [[ -n "$mcp_tag" ]]; then
    log_ok "GRAPHITI_MCP_IMAGE_TAG set"
  else
    log_fail "GRAPHITI_MCP_IMAGE_TAG not set (required for production)"
  fi

  local falkor_password="${GRAPHITI_FALKORDB_PASSWORD:-${FALKORDB_PASSWORD:-}}"
  if [[ -z "$falkor_password" ]]; then
    falkor_password="$(get_env_value "GRAPHITI_FALKORDB_PASSWORD" "$ROOT_DIR/auto-codex/.env" || true)"
  fi
  if [[ -z "$falkor_password" ]]; then
    falkor_password="$(get_env_value "FALKORDB_PASSWORD" "$ROOT_DIR/auto-codex/.env" || true)"
  fi
  if [[ -z "$falkor_password" ]]; then
    falkor_password="$(get_env_value "GRAPHITI_FALKORDB_PASSWORD" "$ROOT_DIR/.env" || true)"
  fi
  if [[ -z "$falkor_password" ]]; then
    falkor_password="$(get_env_value "FALKORDB_PASSWORD" "$ROOT_DIR/.env" || true)"
  fi

  local falkor_args="${FALKORDB_ARGS:-}"
  if [[ -z "$falkor_args" ]]; then
    falkor_args="$(get_env_value "FALKORDB_ARGS" "$ROOT_DIR/.env" || true)"
  fi

  local enforce_auth="${AUTO_CODEX_ENFORCE_FALKORDB_AUTH:-}"
  if is_true "$enforce_auth"; then
    if [[ -n "$falkor_password" ]]; then
      log_ok "GRAPHITI_FALKORDB_PASSWORD set"
    else
      log_fail "GRAPHITI_FALKORDB_PASSWORD not set (required when AUTO_CODEX_ENFORCE_FALKORDB_AUTH=true)"
    fi
    if [[ "$falkor_args" == *"--requirepass"* ]]; then
      log_ok "FALKORDB_ARGS includes --requirepass"
    else
      log_fail "FALKORDB_ARGS missing --requirepass (required when AUTO_CODEX_ENFORCE_FALKORDB_AUTH=true)"
    fi
  else
    if [[ -n "$falkor_password" ]]; then
      log_ok "GRAPHITI_FALKORDB_PASSWORD set"
    else
      log_warn "GRAPHITI_FALKORDB_PASSWORD not set (recommended for production)"
    fi
    if [[ "$falkor_args" == *"--requirepass"* ]]; then
      log_ok "FALKORDB_ARGS includes --requirepass"
    else
      log_warn "FALKORDB_ARGS missing --requirepass (recommended for production)"
    fi
  fi
}

echo "Auto-Codex health check"
echo "Root: $ROOT_DIR"
echo

check_python
check_node
check_cmd git "git"
check_git_repo
check_git_clean
check_auth
check_sandbox
check_graphiti

# Lockfiles (recommended for deterministic installs)
check_file "$ROOT_DIR/auto-codex/requirements-py312.lock" "requirements-py312.lock"
check_file "$ROOT_DIR/auto-codex/requirements-py313.lock" "requirements-py313.lock"
check_file "$ROOT_DIR/tests/requirements-test-py312.lock" "requirements-test-py312.lock"
check_file "$ROOT_DIR/tests/requirements-test-py313.lock" "requirements-test-py313.lock"
check_file "$ROOT_DIR/auto-codex-ui/pnpm-lock.yaml" "pnpm-lock.yaml"

echo
if [[ "$failures" -gt 0 ]]; then
  echo "[summary] FAIL ($failures)"
  exit 1
fi
if [[ "$warnings" -gt 0 ]]; then
  echo "[summary] WARN ($warnings)"
  exit 0
fi
echo "[summary] OK"
