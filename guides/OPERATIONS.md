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

## Data Locations

### Task Logs (Per Project)

Task execution logs are stored per-spec under:

`<your-project>/.auto-codex/specs/<spec>/logs/`

### Memory Layer (FalkorDB)

Docker named volume:

`auto-codex_falkordb_data`

## Backup & Restore

### FalkorDB Backup (Recommended)

Create a timestamped tarball of the Docker volume:

`mkdir -p backups && docker run --rm -v auto-codex_falkordb_data:/data -v "$(pwd)/backups:/backup" alpine sh -c 'tar -czf /backup/falkordb_data_$(date +%Y%m%d_%H%M%S).tar.gz -C /data .'`

Restore (destructive; stops services first):

`docker-compose down && docker run --rm -v auto-codex_falkordb_data:/data -v "$(pwd)/backups:/backup" alpine sh -c 'rm -rf /data/* && tar -xzf /backup/<your_backup>.tar.gz -C /data' && docker-compose up -d`

### Task Logs Backup

Back up `.auto-codex/` in each target project (or at least `.auto-codex/specs/**/logs`).

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
   - Docker logs: `docker-compose logs -f --tail=500`
2. Verify dependencies:
   - `codex --version`, `node --version`, `python3 --version`
3. Disable non-essential integrations to isolate:
   - Stop memory layer: `docker-compose down`
   - Run with minimal env vars (no Linear/GitHub tokens)
4. Roll back if needed (desktop artifact / docker tags)

