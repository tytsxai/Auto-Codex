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

- `falkordb` uses a container healthcheck (`redis-cli ping`).
- `graphiti-mcp` uses an HTTP-response healthcheck (no strict `/health` endpoint).

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

Restore (destructive; stops services first):

`./scripts/restore-falkordb.sh backups/<your_backup>.tar.gz`

Validation:

- `docker-compose ps` shows both services healthy
- Graphiti can connect to FalkorDB (healthcheck passes)

### FalkorDB Hardening (Production)

If you are migrating from an existing container, **back up first**, then:

1. `docker-compose down`
2. `./scripts/backup-falkordb.sh`
3. Remove the old container (volume preserved): `docker rm -f auto-codex-falkordb`
4. Restart with hardened settings (appendonly + localhost bind + persistent volume): `docker-compose up -d`

### Task Logs Backup

Back up `.auto-codex/` in each target project (or at least `.auto-codex/specs/**/logs`).

### UI State Backup

Back up the Electron userData directory noted above if you need to preserve UI settings and profiles.

Restore steps:

1. Quit the desktop app.
2. Replace the userData directory with your backup.
3. Restart the app and confirm settings load.

Validation checklist (UI):

- App launches without error
- Settings values are present
- You can open a project
- Create a small change and restart; it persists

### Main Process Logs (Desktop UI)

Logs are written to `<userData>/logs/main.log` with size-based rotation (keeps last 5 files).

- Collect logs for support: `<userData>/logs/`
- Redaction: API keys and tokens are scrubbed before writing to disk

## Release & Rollback

### Release

See `RELEASE.md` for the packaging flow and tag/version validation.

### Rollback (Desktop App)

- Keep at least the last 1–2 releases available in GitHub Releases.
- Roll back by installing a prior release artifact.

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
