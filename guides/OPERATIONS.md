# Operations Runbook (Production)

This runbook covers the minimum operational procedures to keep Auto-Codex stable in production-like usage.

## What “Production” Means Here

Auto-Codex is primarily a **desktop app**. Production readiness focuses on:

- Deterministic builds and releases
- Reliable local services (FalkorDB + Graphiti MCP) when enabled
- Safe configuration and secret handling
- Backup/restore for persistent data (memory layer + task logs)
- Debuggability (logs) and safe rollback

## Configuration & Secrets

- UI env: `auto-codex-ui/.env` (see `auto-codex-ui/.env.example`)
- Backend env: `auto-codex/.env` (see `auto-codex/.env.example`)
- Never commit `.env` files (they are gitignored).
- Prefer exporting secrets via your shell/CI secret store instead of writing them to disk.
- For production, keep the Codex CLI sandbox enabled: set `AUTO_CODEX_BYPASS_CODEX_SANDBOX=0`.
- For production, do **not** enable:
  - `AUTO_CODEX_ALLOW_UNSIGNED_UPDATES`
  - `AUTO_CODEX_ALLOW_INSECURE_TOKEN_STORAGE`

### Risk Policy (UI Settings)

The desktop app reads `riskPolicy` from `<userData>/settings.json` to gate high-impact automation.

- Values: `conservative` (default), `standard`, `permissive`
- Behavior: competitor analysis in Roadmap generation is **blocked unless** `riskPolicy` is `permissive`

Example snippet:

```json
{
  "riskPolicy": "permissive"
}
```

## Preflight Readiness Check

Run before a release or after changing dependencies/env:

`./scripts/healthcheck.sh`

This validates Python/Node/Git/Codex auth, ensures the git working tree is clean, and if Graphiti is enabled it validates the Graphiti config (provider credentials + FalkorDB settings) and checks Docker/Compose + pinned image tags. A non-zero exit indicates a blocking issue.

Note: Graphiti config validation reads from environment and `.env` files. If your API keys live in the UI's secure storage, export them (or temporarily disable `GRAPHITI_ENABLED`) before running the healthcheck.

For internal "production-lite" gating, set `AUTO_CODEX_PRODUCTION=true` to require healthchecks in release scripts and enforce critical safety checks (sandbox + FalkorDB auth + backup freshness when Graphiti is enabled). If you want stricter gating, set `AUTO_CODEX_ENFORCE_CLEAN_GIT=true` and/or strict security enforcement via `AUTO_CODEX_ENFORCE_SANDBOX=true` and `AUTO_CODEX_ENFORCE_FALKORDB_AUTH=true` to turn warnings into failures. Backup checks can be tuned via `AUTO_CODEX_BACKUP_MAX_AGE_DAYS` (default: 7) or disabled with `AUTO_CODEX_BACKUP_MAX_AGE_DAYS=0`.

## Production Readiness Minimums (Checklist)

Use this as a **go/no-go** checklist before shipping:

- `AUTO_CODEX_PRODUCTION=true` set in your release environment.
- `AUTO_CODEX_ALLOW_UNSIGNED_UPDATES` **not** enabled.
- `AUTO_CODEX_ALLOW_INSECURE_TOKEN_STORAGE` **not** enabled.
- `FALKORDB_ARGS` includes `--requirepass` and `--appendonly yes`.
- `GRAPHITI_FALKORDB_PASSWORD` set (and matches `--requirepass`).
- `FALKORDB_IMAGE_TAG` and `GRAPHITI_MCP_IMAGE_TAG` pinned (no `latest`).
- Scheduled backups enabled (`./scripts/backup-falkordb.sh` and/or `./scripts/backup-userdata.sh`).
- Latest backup age is within `AUTO_CODEX_BACKUP_MAX_AGE_DAYS` (default 7).
- Restore drill completed at least once per quarter (see below).
- `./scripts/healthcheck.sh` passes in the release environment.

## Dependency Locking (Production)

Use the Python-versioned lock files for deterministic installs:

- `auto-codex/requirements-py312.lock`
- `auto-codex/requirements-py313.lock`
- `tests/requirements-test-py312.lock`
- `tests/requirements-test-py313.lock`

Update them with:

`./scripts/lock-deps.sh`

If you need to regenerate locks for a supported Python minor, run:

`./scripts/lock-deps.sh 3.12 3.13`

## Services: Memory Layer (FalkorDB + Graphiti MCP)

Start:

`docker-compose up -d`

Check status:

`docker-compose ps`

Logs:

`docker-compose logs -f --tail=200`

Stop:

`docker-compose down`

### Health

- `falkordb` uses a container healthcheck (`redis-cli ping`, with auth if configured).
- `graphiti-mcp` uses an HTTP-response healthcheck (no strict `/health` endpoint).

**Auth note:** If you enable `--requirepass`, ensure `GRAPHITI_FALKORDB_PASSWORD` (or `FALKORDB_PASSWORD`) is set in the same environment the app/compose uses. The Desktop UI reads these from process env and the effective `auto-codex/.env` (and falls back to repo `.env` when running from source).

### Network Exposure (Important)

By default, `docker-compose.yml` binds service ports to `127.0.0.1` only. Do not expose FalkorDB to untrusted networks.

### Reproducible Images (Recommended)

For production-like stability, pin image tags (required for production) instead of using `:latest`:

- `FALKORDB_IMAGE_TAG=...`
- `GRAPHITI_MCP_IMAGE_TAG=...`

## Data Locations

### Task Logs (Per Project)

Task execution logs are stored per-spec under:

`<your-project>/.auto-codex/specs/<spec>/logs/`

Notes:
- Task logs are redacted for common secret patterns, but should still be treated as sensitive.

### Desktop App State (Auto-Codex UI)

The UI stores persistent state in Electron's userData directory (`app.getPath('userData')`), including:

- `store/projects.json` (project list + settings)
- `config/codex-profiles.json` (profile settings; OAuth tokens are encrypted when possible)
- `sessions/terminals.json` (recent terminal sessions)
- `logs/main.log` (main-process logs, rotated)

**Backup note:** safeStorage encryption is OS/user-bound. Restoring `codex-profiles.json` onto a different machine/user may require re-auth.

Default userData locations by OS (verify in-app if customized):

- macOS: `~/Library/Application Support/Auto Codex/`
- Windows: `%APPDATA%\\Auto Codex\\`
- Linux: `~/.config/Auto Codex/`

### Memory Layer (FalkorDB)

Docker named volume:

`auto-codex_falkordb_data`

This is used by `docker-compose` and by the Desktop UI's auto-started FalkorDB container.

## Backup & Restore

### FalkorDB Backup (Recommended)

Create a timestamped tarball of the Docker volume:

`./scripts/backup-falkordb.sh`

Notes:
- If `AUTO_CODEX_PRODUCTION=true` and `FALKORDB_BACKUP_MODE` is not set, the script defaults to `save` mode for consistency.

Optional retention:

`BACKUP_RETENTION_DAYS=14 ./scripts/backup-falkordb.sh`

Example cron (daily at 2am, keep 14 days):

`0 2 * * * BACKUP_RETENTION_DAYS=14 /path/to/Auto-Codex/scripts/backup-falkordb.sh`

Consistency modes (recommended for production):

- `FALKORDB_BACKUP_MODE=save ./scripts/backup-falkordb.sh` (triggers `SAVE` before backup)
- `FALKORDB_BACKUP_MODE=stop ./scripts/backup-falkordb.sh` (temporarily stops FalkorDB for a consistent volume snapshot)

If auth is enabled, set `GRAPHITI_FALKORDB_PASSWORD` so the `SAVE` command can authenticate.

Restore (destructive; stops services first):

`./scripts/restore-falkordb.sh backups/<your_backup>.tar.gz`

Validation:

- `docker-compose ps` shows both services healthy
- Graphiti can connect to FalkorDB (healthcheck passes)

**Healthcheck enforcement (optional):**
- `AUTO_CODEX_PRODUCTION=true` enforces backup presence/age checks when Graphiti is enabled.
- Or set `AUTO_CODEX_ENFORCE_BACKUPS=true` explicitly.
- Configure max age (days) via `AUTO_CODEX_BACKUP_MAX_AGE_DAYS` (default 7, set `0` to disable).

### FalkorDB Hardening (Production)

If you are migrating from an existing container, **back up first**, then:

1. `docker-compose down`
2. `./scripts/backup-falkordb.sh`
3. Remove the old container (volume preserved): `docker rm -f auto-codex-falkordb`
4. Restart with hardened settings (appendonly + localhost bind + persistent volume + auth):
   - Set `FALKORDB_ARGS=--appendonly yes --requirepass <password>` in `.env`
   - Set `GRAPHITI_FALKORDB_PASSWORD=<password>` (or `FALKORDB_PASSWORD=<password>`) in `auto-codex/.env` (and for Graphiti MCP)
   - `docker-compose up -d`

### Task Logs Backup

Back up `.auto-codex/` in each target project (or at least `.auto-codex/specs/**/logs`).

### Task Logs Retention

`task_logs.json` grows over time in each spec. For long-running tasks, set:

`AUTO_CODEX_TASK_LOG_MAX_ENTRIES=2000`

Set to `0` to disable pruning. Consider periodic cleanup of old specs under `.auto-codex/specs/`.

### UI State Backup

Back up the Electron userData directory noted above if you need to preserve UI settings and profiles.

### UI State Backup (Script)

macOS/Linux helper:

`./scripts/backup-userdata.sh`

Optional retention:

`BACKUP_RETENTION_DAYS=14 ./scripts/backup-userdata.sh`

Restore steps:

1. Quit the desktop app.
2. Replace the userData directory with your backup.
3. Restart the app and confirm settings load.

Validation checklist (UI):

- App launches without error
- Settings values are present
- You can open a project
- Create a small change and restart; it persists

### UI State Backup (Scheduled)

If you rely on UI settings/profiles, back up userData on a schedule.

macOS/Linux example (daily tarball, keep 14 days):

```bash
USERDATA_DIR="$HOME/Library/Application Support/Auto Codex"
BACKUP_DIR="/path/to/backups"
mkdir -p "$BACKUP_DIR"
ts="$(date +%Y%m%d-%H%M%S)"
tar -czf "$BACKUP_DIR/userdata-$ts.tar.gz" -C "$USERDATA_DIR" .
find "$BACKUP_DIR" -name "userdata-*.tar.gz" -mtime +14 -delete
```

Windows example (PowerShell):

```powershell
$UserData = "$env:APPDATA\\Auto Codex"
$BackupDir = "C:\\backups"
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
Compress-Archive -Path "$UserData\\*" -DestinationPath "$BackupDir\\userdata-$Stamp.zip"
Get-ChildItem $BackupDir -Filter "userdata-*.zip" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-14) } | Remove-Item
```

Notes:
- Backups can include sensitive tokens; store them securely.
- If you restore onto a different machine/user, you may need to re-authenticate.

### Main Process Logs (Desktop UI)

Logs are written to `<userData>/logs/main.log` with size-based rotation (keeps last 5 files).

- Collect logs for support: `<userData>/logs/`
- Redaction: API keys and tokens are scrubbed before writing to disk

### Restore Drill (Recommended)

Perform a restore drill quarterly on a non-production machine:

1. Take a fresh backup: `./scripts/backup-falkordb.sh`
2. Restore it: `./scripts/restore-falkordb.sh backups/<your_backup>.tar.gz`
3. Validate: `docker-compose ps` shows healthy, and Graphiti can connect.

## Monitoring & Alerts (Minimal)

- Check container health: `docker-compose ps` (or `docker compose ps`) should show `healthy` for Graphiti/FalkorDB.
- Track disk usage for Docker volume `auto-codex_falkordb_data` and the `backups/` directory.
- Review logs for repeated failures: `<userData>/logs/` and `.auto-codex/specs/**/logs`.
- Optional: enable command audit logging with `AUTO_CODEX_AUDIT_LOG=/path/to/audit.log`.
  - Built-in rotation: `AUTO_CODEX_AUDIT_LOG_MAX_BYTES` + `AUTO_CODEX_AUDIT_LOG_BACKUPS`
  - Or manage rotation via your OS log rotation tooling.

## Release & Rollback

### Release

See `RELEASE.md` for the packaging flow and tag/version validation.

### Roadmap Evaluation (CLI)

When running the Roadmap generator via CLI, you can evaluate output quality:

```bash
python3 auto-codex/runners/roadmap_runner.py --project /path/to/project --eval
python3 auto-codex/runners/roadmap_runner.py --project /path/to/project --eval --judge
```

- `--eval` writes `.auto-codex/roadmap/roadmap_eval.json`
- `--judge` enables LLM-based judging (requires `--eval`)

### Source Update Integrity

The source updater verifies `SHA256SUMS` release assets before applying updates.
If you must bypass verification (not recommended), set `AUTO_CODEX_ALLOW_UNSIGNED_UPDATES=true`.

### Rollback (Desktop App)

- Keep at least the last 1–2 releases available in GitHub Releases.
- Roll back by installing a prior release artifact.

### Rollback (Auto-Codex Source Updates)

The Desktop UI can update the bundled `auto-codex/` source in-place (stored under userData as a source override).
Each update now creates a local backup before applying changes.

**Paths (relative to userData):**
- `auto-codex-source/` - active override used by the app (if present)
- `auto-codex-updates/backup/` - last-known-good backup (overwritten each update)

**Fast rollback to bundled version:**
1. Quit the app.
2. Delete `<userData>/auto-codex-source/`.
3. Restart the app (it will fall back to the bundled source).

**Rollback to previous source (if you want to keep the override):**
1. Quit the app.
2. Replace `<userData>/auto-codex-source/` with `<userData>/auto-codex-updates/backup/`.
3. Restart the app.

Notes:
- `.env` and `specs/` are preserved across updates/rollbacks (they live alongside the source override).
- If rollback fails, delete `auto-codex-source/` to force the bundled fallback.

### Rollback (Docker Services)

- Pin image tags for production.
- Roll back by restoring the previous tags and restarting:
  - `docker-compose pull && docker-compose up -d`
- If data corruption is suspected, restore from backup (above).

## Incident Checklist

1. Collect logs:
   - UI logs: task logs under `.auto-codex/specs/**/logs`
   - Main-process logs: `<userData>/logs/`
   - Docker logs: `docker-compose logs -f --tail=500`
2. Verify dependencies:
   - `codex --version`, `node --version`, `python3 --version`
3. Disable non-essential integrations to isolate:
   - Stop memory layer: `docker-compose down`
   - Run with minimal env vars (no Linear/GitHub tokens)
4. Roll back if needed (desktop artifact / docker tags)
