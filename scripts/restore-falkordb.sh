#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VOLUME_NAME="${FALKORDB_VOLUME:-auto-codex_falkordb_data}"

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <backup_tar_gz_path>"
  exit 2
fi

BACKUP_FILE="$1"
if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Backup file not found: $BACKUP_FILE"
  exit 2
fi

echo "[restore] This will stop services and overwrite volume data."
echo "[restore] Volume: $VOLUME_NAME"
echo "[restore] Backup: $BACKUP_FILE"

docker-compose -f "$ROOT_DIR/docker-compose.yml" down

docker run --rm \
  -v "${VOLUME_NAME}:/data" \
  -v "$(cd "$(dirname "$BACKUP_FILE")" && pwd):/backup" \
  alpine sh -c "rm -rf /data/* && tar -xzf /backup/$(basename "$BACKUP_FILE") -C /data"

docker-compose -f "$ROOT_DIR/docker-compose.yml" up -d

echo "[restore] Done"

