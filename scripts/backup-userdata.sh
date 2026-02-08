#!/usr/bin/env bash
set -euo pipefail
umask 077

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-}"
USERDATA_DIR="${USERDATA_DIR:-}"

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

if [[ ! -s "$OUT_FILE" ]]; then
  echo "[backup] Error: backup file is empty: $OUT_FILE"
  exit 1
fi

if ! tar -tzf "$OUT_FILE" >/dev/null 2>&1; then
  echo "[backup] Error: backup archive integrity check failed: $OUT_FILE"
  exit 1
fi

if write_checksum_file "$OUT_FILE"; then
  echo "[backup] Checksum: ${OUT_FILE}.sha256"
else
  echo "[backup] Warning: no SHA-256 tool found (sha256sum/shasum/openssl), checksum not generated"
fi

if [[ -n "$RETENTION_DAYS" ]]; then
  if [[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]]; then
    echo "[backup] Pruning backups older than ${RETENTION_DAYS} days"
    find "$BACKUP_DIR" -name "userdata_*.tar.gz" -mtime +"$RETENTION_DAYS" -print -delete
    find "$BACKUP_DIR" -name "userdata_*.tar.gz.sha256" -mtime +"$RETENTION_DAYS" -print -delete
  else
    echo "[backup] Warning: BACKUP_RETENTION_DAYS is not an integer, skipping prune"
  fi
fi

echo "[backup] Done"
