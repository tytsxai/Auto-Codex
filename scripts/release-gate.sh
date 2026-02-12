#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "[gate] Auto-Codex release gate"
echo "[gate] Root: $ROOT_DIR"

echo "[gate] Enabling production gate mode (AUTO_CODEX_PRODUCTION=true)"
export AUTO_CODEX_PRODUCTION=true

echo "[gate] Running healthcheck"
"$ROOT_DIR/scripts/healthcheck.sh"

echo "[gate] Running UI lint"
pnpm --dir "$ROOT_DIR/auto-codex-ui" lint

echo "[gate] Running UI typecheck"
pnpm --dir "$ROOT_DIR/auto-codex-ui" typecheck

echo "[gate] Running targeted UI stability tests"
pnpm --dir "$ROOT_DIR/auto-codex-ui" test \
  src/main/__tests__/log-service.test.ts \
  src/main/__tests__/update-installer.test.ts \
  src/shared/utils/__tests__/debug-logger.test.ts

if [[ -x "$ROOT_DIR/auto-codex/.venv/bin/python" ]]; then
  PYTHON_BIN="$ROOT_DIR/auto-codex/.venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
else
  echo "[gate] Error: python not found"
  exit 1
fi

echo "[gate] Running backend critical tests"
"$PYTHON_BIN" -m pytest \
  "$ROOT_DIR/tests/test_workflow_manager.py" \
  "$ROOT_DIR/tests/test_workspace.py" \
  -q

echo "[gate] Running backend collection check"
"$PYTHON_BIN" -m pytest \
  "$ROOT_DIR/tests" \
  --collect-only \
  -q

echo "[gate] PASS"
