#!/usr/bin/env bash
set -euo pipefail
umask 077

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VOLUME_NAME="${FALKORDB_VOLUME:-auto-codex_falkordb_data}"
COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"
BACKUP_IMAGE="${BACKUP_IMAGE:-alpine:3.20}"
PRE_RESTORE_BACKUP_DIR="${PRE_RESTORE_BACKUP_DIR:-${BACKUP_DIR:-$ROOT_DIR/backups}}"
FALKORDB_CONTAINER_NAME="${FALKORDB_CONTAINER_NAME:-auto-codex-falkordb}"
GRAPHITI_MCP_CONTAINER_NAME="${GRAPHITI_MCP_CONTAINER_NAME:-auto-codex-graphiti-mcp}"
RESTORE_HEALTH_TIMEOUT_SECS="${RESTORE_HEALTH_TIMEOUT_SECS:-120}"

is_true() {
  case "${1:-}" in
    [Tt][Rr][Uu][Ee]|1|[Yy][Ee][Ss]|[Oo][Nn]) return 0 ;;
    *) return 1 ;;
  esac
}

require_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "[restore] Error: docker not found"
    exit 1
  fi
  if ! docker info >/dev/null 2>&1; then
    echo "[restore] Error: docker daemon not running"
    exit 1
  fi
}

detect_compose_cmd() {
  if docker compose version >/dev/null 2>&1; then
    echo "docker compose"
    return 0
  fi
  if command -v docker-compose >/dev/null 2>&1 && docker-compose version >/dev/null 2>&1; then
    echo "docker-compose"
    return 0
  fi
  return 1
}

compute_sha256() {
  local file="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$file" | awk '{print $1}'
    return 0
  fi
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$file" | awk '{print $1}'
    return 0
  fi
  if command -v openssl >/dev/null 2>&1; then
    openssl dgst -sha256 "$file" | awk '{print $NF}'
    return 0
  fi
  return 1
}

write_checksum_file() {
  local file="$1"
  local checksum_file="${file}.sha256"
  local checksum
  if ! checksum="$(compute_sha256 "$file")"; then
    return 1
  fi
  printf "%s  %s\n" "$checksum" "$(basename "$file")" > "$checksum_file"
  chmod 600 "$checksum_file" 2>/dev/null || true
}

verify_checksum_if_available() {
  local file="$1"
  local checksum_file="${file}.sha256"
  if [[ ! -f "$checksum_file" ]]; then
    echo "[restore] Warning: checksum file not found: $checksum_file"
    return 0
  fi

  local expected actual
  expected="$(awk 'NF {print $1; exit}' "$checksum_file")"
  if [[ -z "$expected" ]]; then
    echo "[restore] Error: checksum file is empty or invalid: $checksum_file"
    exit 1
  fi

  if ! actual="$(compute_sha256 "$file")"; then
    echo "[restore] Warning: no SHA-256 tool found (sha256sum/shasum/openssl); skipping checksum verification"
    return 0
  fi

  if [[ "$actual" != "$expected" ]]; then
    echo "[restore] Error: checksum mismatch for $file"
    echo "[restore] Expected: $expected"
    echo "[restore] Actual:   $actual"
    exit 1
  fi

  echo "[restore] Checksum verified"
}

container_exists() {
  local container_name="$1"
  docker ps -a --format '{{.Names}}' | grep -Fxq "$container_name"
}

wait_for_container_ready() {
  local container_name="$1"
  local timeout_secs="$2"

  if ! container_exists "$container_name"; then
    echo "[restore] Warning: container not found (skipping health wait): $container_name"
    return 0
  fi

  echo "[restore] Waiting for container readiness: $container_name (timeout: ${timeout_secs}s)"

  local waited=0
  while [[ "$waited" -lt "$timeout_secs" ]]; do
    local running health
    running="$(docker inspect -f '{{.State.Running}}' "$container_name" 2>/dev/null || echo false)"
    health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_name" 2>/dev/null || echo unknown)"

    if [[ "$running" == "true" ]]; then
      case "$health" in
        healthy)
          echo "[restore] Container healthy: $container_name"
          return 0
          ;;
        none)
          echo "[restore] Container running (no healthcheck): $container_name"
          return 0
          ;;
        unhealthy)
          echo "[restore] Error: container unhealthy: $container_name"
          docker logs --tail 80 "$container_name" || true
          return 1
          ;;
      esac
    fi

    sleep 2
    waited=$((waited + 2))
  done

  echo "[restore] Error: timeout waiting for container readiness: $container_name"
  docker logs --tail 80 "$container_name" || true
  return 1
}

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <backup_tar_gz_path>"
  exit 2
fi

BACKUP_FILE="$1"
if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Backup file not found: $BACKUP_FILE"
  exit 2
fi
BACKUP_BASENAME="$(basename "$BACKUP_FILE")"

if ! tar -tzf "$BACKUP_FILE" >/dev/null 2>&1; then
  echo "[restore] Error: backup archive integrity check failed: $BACKUP_FILE"
  exit 1
fi

verify_checksum_if_available "$BACKUP_FILE"

require_docker
compose_cmd="$(detect_compose_cmd || true)"
if [[ -z "$compose_cmd" ]]; then
  echo "[restore] Error: docker compose/docker-compose not found"
  exit 1
fi

echo "[restore] This will stop services and overwrite volume data."
echo "[restore] Volume: $VOLUME_NAME"
echo "[restore] Backup: $BACKUP_FILE"

mkdir -p "$PRE_RESTORE_BACKUP_DIR"
STAMP="$(date +%Y%m%d_%H%M%S)"
PRE_BACKUP_FILE="$PRE_RESTORE_BACKUP_DIR/falkordb_pre_restore_${STAMP}.tar.gz"
PRE_BACKUP_BASENAME="$(basename "$PRE_BACKUP_FILE")"

if [[ "$compose_cmd" == "docker compose" ]]; then
  docker compose -f "$COMPOSE_FILE" down
else
  docker-compose -f "$COMPOSE_FILE" down
fi

echo "[restore] Creating pre-restore safety backup: $PRE_BACKUP_FILE"
docker run --rm \
  -v "${VOLUME_NAME}:/data" \
  -v "${PRE_RESTORE_BACKUP_DIR}:/backup" \
  "${BACKUP_IMAGE}" sh -c 'tar -czf "/backup/$1" -C /data .' _ "$PRE_BACKUP_BASENAME"

if [[ ! -s "$PRE_BACKUP_FILE" ]]; then
  echo "[restore] Error: pre-restore backup is empty: $PRE_BACKUP_FILE"
  exit 1
fi

if ! tar -tzf "$PRE_BACKUP_FILE" >/dev/null 2>&1; then
  echo "[restore] Error: pre-restore backup integrity check failed"
  exit 1
fi

if write_checksum_file "$PRE_BACKUP_FILE"; then
  echo "[restore] Pre-restore checksum: ${PRE_BACKUP_FILE}.sha256"
else
  echo "[restore] Warning: no SHA-256 tool found (sha256sum/shasum/openssl), pre-restore checksum not generated"
fi

docker run --rm \
  -v "${VOLUME_NAME}:/data" \
  -v "$(cd "$(dirname "$BACKUP_FILE")" && pwd):/backup" \
  "${BACKUP_IMAGE}" sh -c 'rm -rf /data/* /data/.[!.]* /data/..?* && tar -xzf "/backup/$1" -C /data' _ "$BACKUP_BASENAME"

if [[ "$compose_cmd" == "docker compose" ]]; then
  docker compose -f "$COMPOSE_FILE" up -d
else
  docker-compose -f "$COMPOSE_FILE" up -d
fi

if is_true "${SKIP_RESTORE_HEALTH_WAIT:-}"; then
  echo "[restore] Skipping post-restore health wait (SKIP_RESTORE_HEALTH_WAIT=true)"
else
  wait_for_container_ready "$FALKORDB_CONTAINER_NAME" "$RESTORE_HEALTH_TIMEOUT_SECS"
  wait_for_container_ready "$GRAPHITI_MCP_CONTAINER_NAME" "$RESTORE_HEALTH_TIMEOUT_SECS"
fi

echo "[restore] Done"
echo "[restore] Pre-restore backup: $PRE_BACKUP_FILE"
