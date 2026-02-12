#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

if ! command -v uv >/dev/null 2>&1; then
  echo "[lock] Error: uv not found. Install with: pip install uv"
  exit 1
fi

versions=("$@")
if [[ ${#versions[@]} -eq 0 ]]; then
  versions=("3.12" "3.13")
fi

for version in "${versions[@]}"; do
  nodot="${version//./}"
  echo "[lock] Resolving Python ${version} -> py${nodot}"
  uv pip compile --python-version "$version" \
    "auto-codex/requirements.txt" \
    -o "auto-codex/requirements-py${nodot}.lock"
  uv pip compile --python-version "$version" \
    "tests/requirements-test.txt" \
    -o "tests/requirements-test-py${nodot}.lock"
done

echo "[lock] Done"
