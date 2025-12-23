# Auto-Codex CLI Usage

This document covers terminal-only usage of Auto-Codex. **For most users, we recommend using the [Desktop UI](../README.md) instead** - it provides a better experience with visual task management, progress tracking, and automatic Python environment setup.

## When to Use CLI

- You prefer terminal workflows
- You're running on a headless server
- You're integrating Auto-Codex into scripts or CI/CD

## Prerequisites

- Python 3.12+
- Codex CLI (`npm install -g @openai/codex`)

## Setup

**Step 1:** Navigate to the auto-codex directory

```bash
cd auto-codex
```

**Step 2:** Set up Python environment

```bash
# Using uv (recommended)
uv venv && uv pip install -r requirements.txt

# Or using standard Python
python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
```

**Step 3:** Configure environment

```bash
cp .env.example .env

# Add one Codex auth option
# OPENAI_API_KEY=sk-...
# CODEX_CODE_OAUTH_TOKEN=... (from Codex CLI login, e.g. `codex login --device-auth`)
# CODEX_CONFIG_DIR=/path/to/codex/config
```

## Creating Specs

Run these commands from your **project root** and point to the Auto-Codex scripts:

```bash
# Activate the virtual environment (from auto-codex/)
source .venv/bin/activate

# Create a spec interactively
python3 /path/to/auto-codex/runners/spec_runner.py --interactive

# Or with a task description
python3 /path/to/auto-codex/runners/spec_runner.py --task "Add user authentication with OAuth"

# Force a specific complexity level
python3 /path/to/auto-codex/runners/spec_runner.py --task "Fix button color" --complexity simple

# Continue an interrupted spec
python3 /path/to/auto-codex/runners/spec_runner.py --continue 001-feature
```

### Complexity Tiers

The spec runner automatically assesses task complexity:

| Tier | Phases | When Used |
|------|--------|-----------|
| **SIMPLE** | 3 | 1-2 files, single service, no integrations (UI fixes, text changes) |
| **STANDARD** | 6 | 3-10 files, 1-2 services, minimal integrations (features, bug fixes) |
| **COMPLEX** | 8 | 10+ files, multiple services, external integrations |

## Running Builds

```bash
# List all specs and their status
python3 /path/to/auto-codex/run.py --list

# Run a specific spec
python3 /path/to/auto-codex/run.py --spec 001
python3 /path/to/auto-codex/run.py --spec 001-feature-name

# Limit iterations for testing
python3 /path/to/auto-codex/run.py --spec 001 --max-iterations 5
```

## QA Validation

After all chunks are complete, QA validation runs automatically:

```bash
# Skip automatic QA
python3 /path/to/auto-codex/run.py --spec 001 --skip-qa

# Run QA validation manually
python3 /path/to/auto-codex/run.py --spec 001 --qa

# Check QA status
python3 /path/to/auto-codex/run.py --spec 001 --qa-status
```

The QA validation loop:
1. **QA Reviewer** checks all acceptance criteria
2. If issues found → creates `QA_FIX_REQUEST.md`
3. **QA Fixer** applies fixes
4. Loop repeats until approved (up to 50 iterations)

## Workspace Management

Auto-Codex uses Git worktrees for isolated builds:

```bash
# Test the feature in the isolated workspace
cd .worktrees/<spec-name>/
# e.g. cd .worktrees/001-feature-name/
npm run dev  # or your project's run command

# See what was changed
python3 /path/to/auto-codex/run.py --spec 001 --review

# Merge changes into your project
python3 /path/to/auto-codex/run.py --spec 001 --merge

# Discard if you don't like it
python3 /path/to/auto-codex/run.py --spec 001 --discard
```

## Interactive Controls

While the agent is running:

```bash
# Pause and add instructions
Ctrl+C (once)

# Exit immediately
Ctrl+C (twice)
```

**File-based alternative:**
```bash
# Create PAUSE file to pause after current session
touch specs/001-name/PAUSE

# Add instructions
echo "Focus on fixing the login bug first" > specs/001-name/HUMAN_INPUT.md
```

## Spec Validation

```bash
python3 /path/to/auto-codex/spec/validate_spec.py --spec-dir .auto-codex/specs/001-feature --checkpoint all
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | One of | OpenAI API key for Codex CLI |
| `CODEX_CODE_OAUTH_TOKEN` | One of | OAuth token from Codex CLI login (e.g. `codex login --device-auth`) |
| `CODEX_CONFIG_DIR` | One of | Path to Codex CLI config directory |
| `AUTO_BUILD_MODEL` | No | Model override (default: gpt-5.2-codex) |
| `AUTO_BUILD_REASONING_EFFORT` | No | Reasoning effort override (low/medium/high/xhigh; default: medium) |

## Auto-Codex Memory Layer (Optional)

For cross-session context retention, see the main README for Memory Layer setup instructions.

### Verifying Memory Layer

```bash
cd /path/to/auto-codex
source .venv/bin/activate
python3 integrations/graphiti/test_graphiti_memory.py
```
