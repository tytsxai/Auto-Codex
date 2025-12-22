#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
VOLUME_NAME="${FALKORDB_VOLUME:-auto-codex_falkordb_data}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT_FILE="$BACKUP_DIR/falkordb_data_${STAMP}.tar.gz"

echo "[backup] Volume: $VOLUME_NAME"
echo "[backup] Output: $OUT_FILE"

docker run --rm \
  -v "${VOLUME_NAME}:/data" \
  -v "${BACKUP_DIR}:/backup" \
  alpine sh -c "tar -czf /backup/$(basename "$OUT_FILE") -C /data ."

echo "[backup] Done"

