#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-}"
USERDATA_DIR="${USERDATA_DIR:-}"

if [[ -z "$USERDATA_DIR" ]]; then
  case "$(uname -s)" in
    Darwin)
      USERDATA_DIR="$HOME/Library/Application Support/Auto Codex"
      ;;
    Linux)
      USERDATA_DIR="$HOME/.config/Auto Codex"
      ;;
    *)
      echo "[backup] Error: Unsupported OS. Set USERDATA_DIR explicitly."
      exit 1
      ;;
  esac
fi

if [[ ! -d "$USERDATA_DIR" ]]; then
  echo "[backup] Error: userData directory not found: $USERDATA_DIR"
  exit 1
fi

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT_FILE="$BACKUP_DIR/userdata_${STAMP}.tar.gz"

echo "[backup] userData: $USERDATA_DIR"
echo "[backup] Output: $OUT_FILE"

tar -czf "$OUT_FILE" -C "$USERDATA_DIR" .

if [[ -n "$RETENTION_DAYS" ]]; then
  if [[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]]; then
    echo "[backup] Pruning backups older than ${RETENTION_DAYS} days"
    find "$BACKUP_DIR" -name "userdata_*.tar.gz" -mtime +"$RETENTION_DAYS" -print -delete
  else
    echo "[backup] Warning: BACKUP_RETENTION_DAYS is not an integer, skipping prune"
  fi
fi

echo "[backup] Done"
