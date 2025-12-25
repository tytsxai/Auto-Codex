# AGENTS.md

This file is the lightweight working guide for Codex/LLM agents in this repo.

## Project overview
- **Auto-Codex** is a multi-agent coding framework.
- **auto-codex/**: Python backend (spec runner, agents, memory, security).
- **auto-codex-ui/**: Electron + React desktop UI.
- **guides/**: user-facing docs (CLI, Docker, operations).

## Key paths
- Specs for *user projects* live in `/.auto-codex/` inside the target project, not in this repo.
- Worktrees live under `.worktrees/` in the target project.
- `.kiro/` is legacy tooling; its specs are deprecated and **intentionally removed**.

## Common commands
### UI (auto-codex-ui/)
- Install: `pnpm install`
- Dev: `pnpm run dev`
- Build + start: `pnpm run build && pnpm run start`
- Tests: `pnpm run test` (coverage: `pnpm run test:coverage`)
- Lint: `pnpm run lint`
- Typecheck: `pnpm run typecheck`

### Python backend (auto-codex/)
- Create env: `uv venv && uv pip install -r requirements.txt`
- Tests: `auto-codex/.venv/bin/python -m pytest -v`

## IPC + shared types
- IPC channels live in `auto-codex-ui/src/shared/constants/ipc.ts`.
- When adding/renaming IPC handlers, update preload APIs in `auto-codex-ui/src/preload/` and shared types in `auto-codex-ui/src/shared/types/`.

## Repo hygiene
- Avoid committing generated folders (`auto-codex-ui/dist`, `auto-codex-ui/out`, `auto-codex-ui/coverage`).
- Do not recreate `.kiro/specs` — it is deprecated and intentionally deleted.
