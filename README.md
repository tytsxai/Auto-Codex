# Auto-Codex

Your AI coding companion. Build features, fix bugs, and ship faster — with autonomous agents that plan, code, and validate for you.

This project is a Codex-based fork derived from https://github.com/AndyMik90/Auto-Claude.

![Auto-Codex Kanban Board](.github/assets/Auto-Codex-Kanban.png)

[![Discord](https://img.shields.io/badge/Discord-Join%20Community-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/KCXaPBr4Dj)

## What It Does ✨

**Auto-Codex is a desktop app that supercharges your AI coding workflow.** Whether you're a vibe coder just getting started or an experienced developer, Auto-Codex meets you where you are.

Powered by the OpenAI Codex CLI for reliable, sandboxed agent execution.

- **Autonomous Tasks** — Describe what you want to build, and agents handle planning, coding, and validation while you focus on other work
- **Agent Terminals** — Run Codex CLI in up to 12 terminals with a clean layout, smart naming based on context, and one-click task context injection
- **Safe by Default** — All work happens in git worktrees, keeping your main branch undisturbed until you're ready to merge
- **Self-Validating** — Built-in QA agents check their own work before you review

**The result?** 10x your output while maintaining code quality.

## Key Features

- **Parallel Agents**: Run multiple builds simultaneously while you focus on other work
- **Context Engineering**: Agents understand your codebase structure before writing code
- **Self-Validating**: Built-in QA loop catches issues before you review
- **Isolated Workspaces**: All work happens in git worktrees — your code stays safe
- **AI Merge Resolution**: Intelligent conflict resolution when merging back to main — no manual conflict fixing
- **Memory Layer**: Agents remember insights across sessions for smarter decisions
- **Cross-Platform**: Desktop app runs on Mac, Windows, and Linux
- **Any Project Type**: Build web apps, APIs, CLIs — works with any software project

## 🚀 Quick Start (Desktop UI)

The Desktop UI is the recommended way to use Auto-Codex. It provides visual task management, real-time progress tracking, and a Kanban board interface.

### Prerequisites

1. **Node.js 18+** - [Download Node.js](https://nodejs.org/)
2. **Python 3.10+** - [Download Python](https://www.python.org/downloads/) (3.12+ recommended)
3. **Docker Desktop** - Required for the Memory Layer (optional)
4. **Codex CLI** - `npm install -g @openai/codex`
5. **OpenAI Account** - Required for Codex CLI access (API key or OAuth token for non-interactive use)
6. **Git Repository** - Your project must be initialized as a git repository

### Codex CLI Auth (Required)

```bash
# Verify install
codex --version

# Interactive login (recommended)
codex login
```

If you use a third-party gateway/activator that authenticates Codex CLI via API key (commonly stored in `~/.codex/auth.json` + `~/.codex/config.toml`), Auto-Codex will treat that as authenticated as long as those files are present and valid. Note: GUI-launched apps often do not inherit `.zshrc` environment variables, so prefer the Codex config files over shell-only exports.

**Headless/CI:** set one of these instead of interactive login.

```bash
# Shell env (one-off)
export OPENAI_API_KEY=sk-...

# Or use an OAuth token from Codex CLI login (e.g. `codex login --device-auth`)
export CODEX_CODE_OAUTH_TOKEN=...

# Or point to an existing Codex CLI config directory
export CODEX_CONFIG_DIR=/path/to/codex/config

# Or rely on the default Codex CLI config at ~/.codex
# (disable with AUTO_CODEX_DISABLE_DEFAULT_CODEX_CONFIG_DIR=1)

# Or add any of the above to auto-codex/.env for repeat usage
OPENAI_API_KEY=sk-...
```

### Git Initialization

**Auto-Codex requires a git repository** to create isolated worktrees for safe parallel development. If your project isn't a git repo yet:

```bash
cd your-project
git init
git add .
git commit -m "Initial commit"
```

> **Why git?** Auto-Codex uses git branches and worktrees to isolate each task in its own workspace, keeping your main branch clean until you're ready to merge. This allows you to work on multiple features simultaneously without conflicts.

---

### Installing Docker Desktop

Docker runs the FalkorDB database that powers Auto-Codex's cross-session memory.

| Operating System | Download Link |
|------------------|---------------|
| **Mac (Apple Silicon M1/M2/M3/M4)** | [Download for Apple Chip](https://desktop.docker.com/mac/main/arm64/Docker.dmg) |
| **Mac (Intel)** | [Download for Intel Chip](https://desktop.docker.com/mac/main/amd64/Docker.dmg) |
| **Windows** | [Download for Windows](https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe) |
| **Linux** | [Installation Guide](https://docs.docker.com/desktop/install/linux-install/) |

> **Not sure which Mac?** Click the Apple menu (🍎) → "About This Mac". Look for "Chip" - M1/M2/M3/M4 = Apple Silicon, otherwise Intel.

**After installing:** Open Docker Desktop and wait for the whale icon (🐳) to appear in your menu bar/system tray.

> **Using the Desktop UI?** It automatically detects Docker status and offers one-click FalkorDB setup. No terminal commands needed!

📚 **For detailed installation steps, troubleshooting, and advanced configuration, see [guides/DOCKER-SETUP.md](guides/DOCKER-SETUP.md)**

---

## Production Readiness / Operations

For backup/restore, rollback, and operational procedures, see `guides/OPERATIONS.md`.

### Step 1: Set Up the Python Backend

The Desktop UI runs Python scripts behind the scenes. Set up the Python environment:

```bash
cd auto-codex

# Using uv (recommended)
uv venv && uv pip install -r requirements.txt

# Or using standard Python
python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
```

**Production (deterministic installs):** use the lock file that matches your Python version.

```bash
# Example for Python 3.12/3.13
PY_VER_NODOT=$(python3 -c 'import sys; print(f"{sys.version_info[0]}{sys.version_info[1]}")')
uv pip install -r requirements-py${PY_VER_NODOT}.lock
```

### Step 2: Start the Memory Layer

The Auto-Codex Memory Layer provides cross-session context retention using a graph database:

```bash
# Pin image tags (required in production)
export FALKORDB_IMAGE_TAG=<version>
export GRAPHITI_MCP_IMAGE_TAG=<version>

# Make sure Docker Desktop is running, then:
docker-compose up -d falkordb
```

### Step 3: Install and Launch the Desktop UI

```bash
cd auto-codex-ui

# Install dependencies (pnpm recommended, npm works too)
pnpm install
# or: npm install

# Dev mode (hot reload)
pnpm run dev
# or: npm run dev

# Production build + start
pnpm run build && pnpm run start
# or: npm run build && npm run start
```

<details>
<summary><b>Windows users:</b> If installation fails with node-gyp errors, click here</summary>

Auto-Codex automatically downloads prebuilt binaries for Windows. If prebuilts aren't available for your Electron version yet, you'll need Visual Studio Build Tools:

1. Download [Visual Studio Build Tools 2022](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
2. Select "Desktop development with C++" workload
3. In "Individual Components", add "MSVC v143 - VS 2022 C++ x64/x86 Spectre-mitigated libs"
4. Restart terminal and run `npm install` again

</details>

### Step 4: Start Building

1. Add your project in the UI
2. Create a new task describing what you want to build
3. Watch as Auto-Codex creates a spec, plans, and implements your feature
4. Review changes and merge when satisfied

---

## Legacy Notes

- `.kiro/` (including `.kiro/specs`) is deprecated legacy tooling and is intentionally removed/ignored. Use `.auto-codex/` for specs and task data.

---

## 🎯 Features

### Kanban Board

Plan tasks and let AI handle the planning, coding, and validation — all in a visual interface. Track progress from "Planning" to "Done" while agents work autonomously.

### Agent Terminals

Spawn up to 12 AI-powered terminals for hands-on coding. Inject task context with a click, reference files from your project, and work rapidly across multiple sessions.

**Power users:** Connect multiple OpenAI accounts to run even more agents in parallel — perfect for teams or heavy workloads.

![Auto-Codex Agent Terminals](.github/assets/Auto-Codex-Agents-terminals.png)

### Insights

Have a conversation about your project in a ChatGPT-style interface. Ask questions, get explanations, and explore your codebase through natural dialogue.

### Roadmap

Based on your target audience, AI anticipates and plans the most impactful features you should focus on. Prioritize what matters most to your users.

![Auto-Codex Roadmap](.github/assets/Auto-Codex-roadmap.png)

### Ideation

Let AI help you create a project that shines. Rapidly understand your codebase and discover:
- Code improvements and refactoring opportunities
- Performance bottlenecks
- Security vulnerabilities
- Documentation gaps
- UI/UX enhancements
- Overall code quality issues

### Changelog

Write professional changelogs effortlessly. Generate release notes from completed Auto-Codex tasks or integrate with GitHub to create masterclass changelogs automatically.

### Context

See exactly what Auto-Codex understands about your project — the tech stack, file structure, patterns, and insights it uses to write better code.

### AI Merge Resolution

When your main branch evolves while a build is in progress, Auto-Codex automatically resolves merge conflicts using AI — no manual `<<<<<<< HEAD` fixing required.

**How it works:**
1. **Git Auto-Merge First** — Simple non-conflicting changes merge instantly without AI
2. **Conflict-Only AI** — For actual conflicts, AI receives only the specific conflict regions (not entire files), achieving ~98% prompt reduction
3. **Parallel Processing** — Multiple conflicting files resolve simultaneously for faster merges
4. **Syntax Validation** — Every merge is validated before being applied

**The result:** A build that was 50+ commits behind main merges in seconds instead of requiring manual conflict resolution.

---

## CLI Usage (Terminal-Only)

For terminal-based workflows, headless servers, or CI/CD integration, see **[guides/CLI-USAGE.md](guides/CLI-USAGE.md)**.

### Import Validation

Run a quick Python import validation across the repo:

```bash
./scripts/validate-imports.sh
```

## ⚙️ How It Works

Auto-Codex focuses on three core principles: **context engineering** (understanding your codebase before writing code), **good coding standards** (following best practices and patterns), and **validation logic** (ensuring code works before you see it).

### The Agent Pipeline

**Phase 1: Spec Creation** (3-8 phases based on complexity)

Before any code is written, agents gather context and create a detailed specification:

1. **Discovery** — Analyzes your project structure and tech stack
2. **Requirements** — Gathers what you want to build through interactive conversation
3. **Research** — Validates external integrations against real documentation
4. **Context Discovery** — Finds relevant files in your codebase
5. **Spec Writer** — Creates a comprehensive specification document
6. **Spec Critic** — Self-critiques using extended thinking to find issues early
7. **Planner** — Breaks work into subtasks with dependencies
8. **Validation** — Ensures all outputs are valid before proceeding

**Phase 2: Implementation**

With a validated spec, coding agents execute the plan:

1. **Planner Agent** — Creates subtask-based implementation plan
2. **Coder Agent** — Implements subtasks one-by-one with verification
3. **QA Reviewer** — Validates all acceptance criteria
4. **QA Fixer** — Fixes issues in a self-healing loop (up to 50 iterations)

Each session runs with a fresh context window. Progress is tracked via `implementation_plan.json` and Git commits.

**Phase 3: Merge**

When you're ready to merge, AI handles any conflicts that arose while you were working:

1. **Conflict Detection** — Identifies files modified in both main and the build
2. **3-Tier Resolution** — Git auto-merge → Conflict-only AI → Full-file AI (fallback)
3. **Parallel Merge** — Multiple files resolve simultaneously
4. **Staged for Review** — Changes are staged but not committed, so you can review before finalizing

### 🔒 Security Model

Three-layer defense keeps your code safe:
- **OS Sandbox** — Bash commands run in isolation
- **Filesystem Restrictions** — Operations limited to project directory
- **Command Allowlist** — Only approved commands based on your project's stack

### 🧠 Memory Layer

The Memory Layer is a **hybrid RAG system** combining graph nodes with semantic search to deliver the best possible context during AI coding. Agents remember insights from previous sessions, discovered codebase patterns persist and are reusable, and historical context helps agents make smarter decisions.

**Architecture:**
- **Backend**: FalkorDB (graph database) via Docker
- **Library**: Graphiti for knowledge graph operations
- **Providers**: OpenAI, Anthropic, Azure OpenAI, Google AI, or Ollama (local/offline)

| Setup | LLM | Embeddings | Notes |
|-------|-----|------------|-------|
| **OpenAI** | OpenAI | OpenAI | Simplest - single API key |
| **Anthropic + Voyage** | Anthropic | Voyage AI | High quality |
| **Google AI** | Gemini | Google | Single API key, fast inference |
| **Ollama** | Ollama | Ollama | Fully offline |
| **Azure** | Azure OpenAI | Azure OpenAI | Enterprise |

## Project Structure

```
your-project/
├── .worktrees/               # Created during build (git-ignored)
│   └── <spec-name>/          # Isolated workspace per spec (git worktree)
├── .auto-codex/              # Per-project data (specs, plans, QA reports)
│   ├── specs/                # Task specifications
│   ├── roadmap/              # Project roadmap
│   └── ideation/             # Ideas and planning
├── auto-codex/              # Python backend (framework code)
│   ├── run.py                # Build entry point
│   ├── runners/spec_runner.py # Spec creation orchestrator
│   ├── prompts/              # Agent prompt templates
│   └── ...
├── auto-codex-ui/           # Electron desktop application
│   └── ...
└── docker-compose.yml        # FalkorDB for Memory Layer
```

### Understanding the Folders

**You don't create these folders manually** - they serve different purposes:

- **`auto-codex/`** - The framework repository itself (clone this once from GitHub)
- **`.auto-codex/`** - Created automatically in YOUR project when you run Auto-Codex (stores specs, plans, QA reports)
- **`.worktrees/`** - Isolated workspaces created during builds (git-ignored; clean up via `--discard` / `--cleanup-worktrees` when you no longer need them)

**When using Auto-Codex on your project:**
```bash
cd your-project/              # Your own project directory
python3 /path/to/auto-codex/run.py --spec 001
# Auto-Codex creates .auto-codex/ automatically in your-project/
```

**When developing Auto-Codex itself:**
```bash
git clone https://github.com/tytsxai/Auto-Codex.git
cd auto-codex/               # You're working in the framework repo
```

The `.auto-codex/` directory is gitignored and project-specific - you'll have one per project you use Auto-Codex on.

## Environment Variables (CLI Only)

> **Desktop UI users:** These are configured through the app settings — no manual setup needed.

Existing users migrating from Claude SDK should read `MIGRATION.md`.

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | One of | OpenAI API key for Codex CLI and OpenAI-backed memory providers |
| `CODEX_CODE_OAUTH_TOKEN` | One of | OAuth token from Codex CLI login (e.g. `codex login --device-auth`) |
| `CODEX_CONFIG_DIR` | One of | Path to Codex CLI config directory for profile-based auth |
| `AUTO_CODEX_DISABLE_DEFAULT_CODEX_CONFIG_DIR` | No | Set to `1` to ignore the default `~/.codex` config directory |
| `AUTO_CODEX_BYPASS_CODEX_SANDBOX` | No | Set to `0` to keep Codex CLI sandboxing enabled |
| `AUTO_CODEX_LEGACY_SECURITY` | No | Set to `true` to disable security flag enforcement (backwards compat) |
| `AUTO_BUILD_MODEL` | No | Model override (default: gpt-5.2-codex). Note: reasoning is a runtime parameter; legacy suffix input like `-xhigh` is accepted but discouraged (it is not a real model ID). |
| `AUTO_BUILD_REASONING_EFFORT` | No | Reasoning effort override (low/medium/high/xhigh) |
| `GRAPHITI_ENABLED` | Recommended | Set to `true` to enable Memory Layer |
| `GRAPHITI_LLM_PROVIDER` | For Memory | LLM provider: openai, anthropic, azure_openai, ollama, google |
| `GRAPHITI_EMBEDDER_PROVIDER` | For Memory | Embedder: openai, voyage, azure_openai, ollama, google |
| `ANTHROPIC_API_KEY` | For Anthropic | Required for Anthropic LLM |
| `VOYAGE_API_KEY` | For Voyage | Required for Voyage embeddings |
| `GOOGLE_API_KEY` | For Google | Required for Google AI (Gemini) provider |

See `auto-codex/.env.example` for complete configuration options.

## 💬 Community

Join our Discord to get help, share what you're building, and connect with other Auto-Codex users:

[![Discord](https://img.shields.io/badge/Discord-Join%20Community-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/KCXaPBr4Dj)

## 🤝 Contributing

We welcome contributions! Whether it's bug fixes, new features, or documentation improvements.

See **[CONTRIBUTING.md](CONTRIBUTING.md)** for guidelines on how to get started.

## Acknowledgments

This framework was inspired by Anthropic's [Autonomous Coding Agent](https://github.com/anthropics/claude-quickstarts/tree/main/autonomous-coding). Thank you to the Anthropic team for their innovative work on autonomous coding systems.

## License

**AGPL-3.0** - GNU Affero General Public License v3.0

This software is licensed under AGPL-3.0, which means:

- **Attribution Required**: You must give appropriate credit, provide a link to the license, and indicate if changes were made. When using Auto-Codex, please credit the project.
- **Open Source Required**: If you modify this software and distribute it or run it as a service, you must release your source code under AGPL-3.0.
- **Network Use (Copyleft)**: If you run this software as a network service (e.g., SaaS), users interacting with it over a network must be able to receive the source code.
- **No Closed-Source Usage**: You cannot use this software in proprietary/closed-source projects without open-sourcing your entire project under AGPL-3.0.

**In simple terms**: You can use Auto-Codex freely, but if you build on it, your code must also be open source under AGPL-3.0 and attribute this project. Closed-source commercial use requires a separate license.

For commercial licensing inquiries (closed-source usage), please contact the maintainers.
