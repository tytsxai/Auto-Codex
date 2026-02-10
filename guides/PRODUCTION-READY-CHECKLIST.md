# Production Ready Checklist (Go/No-Go)

This checklist is a practical **release gate** for Auto-Codex. Use it before each production release and after major dependency or infrastructure changes.

> Scope: stable operation of the desktop app + backend runtime + optional Graphiti memory services.

## 1) Must-pass gates (No-Go if any fail)

- `./scripts/healthcheck.sh` exits without `FAIL`.
- `AUTO_CODEX_PRODUCTION=true` is set in release environment.
- `AUTO_CODEX_ALLOW_UNSIGNED_UPDATES` is **not** true.
- `AUTO_CODEX_ALLOW_INSECURE_TOKEN_STORAGE` is **not** true.
- Release preflight is enabled (`AUTO_CODEX_SKIP_RELEASE_PREFLIGHT` is unset/false).
- UI checks pass:
  - `pnpm --dir auto-codex-ui lint`
  - `pnpm --dir auto-codex-ui typecheck`
  - `pnpm --dir auto-codex-ui test`
- Backend tests pass (at minimum):
  - `auto-codex/.venv/bin/python -m pytest tests/ -v`

## 2) Security baseline

- Codex sandbox enforced (`AUTO_CODEX_BYPASS_CODEX_SANDBOX=0` in production).
- No plaintext secrets in committed files (`.env`, logs, snapshots excluded by gitignore).
- If Graphiti/FalkorDB enabled:
  - `FALKORDB_ARGS` includes `--appendonly yes`
  - `FALKORDB_ARGS` includes `--requirepass ...`
  - `GRAPHITI_FALKORDB_PASSWORD` is configured and matches runtime
- Container ports remain loopback-bound (`127.0.0.1`).

## 3) Data durability & recoverability

- Backup jobs configured and verified:
  - `./scripts/backup-falkordb.sh`
  - `./scripts/backup-userdata.sh`
- Latest backup exists, archive is readable, checksum matches.
- Backup retention policy configured (`BACKUP_RETENTION_DAYS`).
- At least one restore drill completed this quarter:
  - `./scripts/restore-falkordb.sh backups/<backup>.tar.gz`
  - Post-restore health checks pass.

## 4) Release / rollback readiness

- Version and changelog consistent with release plan.
- `github:createRelease` preflight passes for target version.
- Rollback path verified:
  - App source rollback via `<userData>/auto-codex-updates/backup/`
  - Data rollback via FalkorDB restore script
- Operator runbook link is known by releaser: `guides/OPERATIONS.md`.

## 5) Observability minimum

- Main-process log rotation works (`<userData>/logs/main.log`).
- Task/session logs are readable and secret-redacted.
- On failure, operator can answer quickly:
  - Which task/spec failed?
  - Was failure infra/auth/config or business logic?
  - Is retry safe without manual cleanup?

## 6) Operational clarity

- Owner for release decision identified.
- Incident contact channel identified.
- “Stop the line” rule agreed: any failed must-pass gate blocks release.

## Fast execution template

```bash
# One-command gate (recommended)
./scripts/release-gate.sh

# Optional backup freshness run (if Graphiti enabled)
./scripts/backup-falkordb.sh
./scripts/backup-userdata.sh
```

If any step fails, treat as **No-Go** until resolved and revalidated.
