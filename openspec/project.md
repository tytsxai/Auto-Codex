# Project Context

## Purpose
Auto-Codex is a desktop application for running autonomous coding agents on top
of the OpenAI Codex CLI. It provides a task board UI, multi-terminal agent
execution, git-worktree isolation per task/spec, and optional cross-session
memory services.

## Tech Stack
- **Desktop UI**: Electron + React + TypeScript (`auto-codex-ui/`)
- **Backend/orchestrator**: Python 3.12+ (`auto-codex/`)
- **Agent execution**: OpenAI Codex CLI (`codex exec --json`)
- **Isolation model**: Git branches + Git worktrees per spec (`.worktrees/<spec>/`)
- **Optional memory**: Docker Compose services (FalkorDB/Redis depending on config)

## Project Conventions

### Code Style
- Prefer small, explicit functions and strong error messages over silent failure.
- Keep “unsafe” execution paths opt-in and clearly surfaced in UI/CLI.

### Architecture Patterns
- Providers: Python wraps Codex CLI via a subprocess adapter (`auto-codex/providers/`).
- Workflows: Each spec/task lives in its own worktree; merge/stage is explicit.
- Security: Secrets scanning and safety checks run before merging/staging.

### Testing Strategy
- Python: `pytest` under `tests/`
- UI: `vitest` under `auto-codex-ui/`
- Prefer unit tests for parsing/merge logic and integration tests for subprocess adapters.

### Git Workflow
- Work is done on `auto-codex/<spec>` branches with worktrees under `.worktrees/`.
- “Merge” should be reviewable (stage-only supported) and leave an audit trail.

## Domain Context
Auto-Codex aims to let users “walk away” while agents plan, code, validate, and
recover from common failures, while keeping the main branch safe via isolation.

## Important Constraints
- The app may run from a GUI environment without a shell `PATH`; detect binaries
  and credentials robustly.
- Long-running subprocesses must avoid deadlocks (e.g., stdout/stderr draining).
- Any destructive actions must be explicit and gated.

## External Dependencies
- OpenAI credentials/config used by Codex CLI
- Docker Desktop (for optional memory services)
