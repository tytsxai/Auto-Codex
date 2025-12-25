#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
VOLUME_NAME="${FALKORDB_VOLUME:-auto-codex_falkordb_data}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-}"
BACKUP_IMAGE="${BACKUP_IMAGE:-alpine:3.20}"
BACKUP_MODE="${FALKORDB_BACKUP_MODE:-live}"
CONTAINER_NAME="${FALKORDB_CONTAINER_NAME:-auto-codex-falkordb}"
FALKORDB_PASSWORD="${GRAPHITI_FALKORDB_PASSWORD:-${FALKORDB_PASSWORD:-}}"
COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"

require_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "[backup] Error: docker not found"
    exit 1
  fi
  if ! docker info >/dev/null 2>&1; then
    echo "[backup] Error: docker daemon not running"
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

is_container_running() {
  docker ps -q -f "name=^${CONTAINER_NAME}$" | grep -q .
}

stop_falkordb() {
  if [[ -n "${compose_cmd:-}" ]]; then
    $compose_cmd -f "$COMPOSE_FILE" stop falkordb
  else
    docker stop "$CONTAINER_NAME"
  fi
}

start_falkordb() {
  if [[ -n "${compose_cmd:-}" ]]; then
    $compose_cmd -f "$COMPOSE_FILE" start falkordb
  else
    docker start "$CONTAINER_NAME"
  fi
}

run_consistent_save() {
  if ! is_container_running; then
    echo "[backup] Warning: ${CONTAINER_NAME} is not running; skipping SAVE step"
    return 0
  fi

  local args=(redis-cli)
  if [[ -n "$FALKORDB_PASSWORD" ]]; then
    args+=("-a" "$FALKORDB_PASSWORD")
  fi
  args+=("SAVE")

  echo "[backup] Triggering FalkorDB SAVE for consistent snapshot"
  docker exec "$CONTAINER_NAME" "${args[@]}"
}

require_docker
compose_cmd="$(detect_compose_cmd || true)"

service_stopped=0
cleanup() {
  if [[ "$service_stopped" -eq 1 ]]; then
    echo "[backup] Restarting FalkorDB service after backup"
    start_falkordb || true
  fi
}
trap cleanup EXIT

case "$BACKUP_MODE" in
  stop)
    echo "[backup] Mode: stop (temporary service stop for consistent backup)"
    stop_falkordb
    service_stopped=1
    ;;
  save)
    echo "[backup] Mode: save (trigger SAVE before backup)"
    run_consistent_save || true
    ;;
  live)
    echo "[backup] Mode: live (no quiesce)"
    ;;
  *)
    echo "[backup] Warning: Unknown FALKORDB_BACKUP_MODE=${BACKUP_MODE}, using live mode"
    ;;
esac

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT_FILE="$BACKUP_DIR/falkordb_data_${STAMP}.tar.gz"

echo "[backup] Volume: $VOLUME_NAME"
echo "[backup] Output: $OUT_FILE"

docker run --rm \
  -v "${VOLUME_NAME}:/data" \
  -v "${BACKUP_DIR}:/backup" \
  "${BACKUP_IMAGE}" sh -c "tar -czf /backup/$(basename "$OUT_FILE") -C /data ."

if [[ -n "$RETENTION_DAYS" ]]; then
  if [[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]]; then
    echo "[backup] Pruning backups older than ${RETENTION_DAYS} days"
    find "$BACKUP_DIR" -name "falkordb_data_*.tar.gz" -mtime +"$RETENTION_DAYS" -print -delete
  else
    echo "[backup] Warning: BACKUP_RETENTION_DAYS is not an integer, skipping prune"
  fi
fi

echo "[backup] Done"
