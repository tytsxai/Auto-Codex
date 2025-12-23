# Migration Guide: Claude SDK → Codex CLI

This guide walks you through migrating Auto-Codex from the Claude SDK to the OpenAI Codex CLI.

## 1) Install Codex CLI

```bash
npm install -g @openai/codex
codex --version
```

## 2) Update Environment Variables

1. Copy the example file if you have not already:

```bash
cd auto-codex
cp .env.example .env
```

2. Replace the old token with a Codex auth option:

```bash
# Remove this (old)
# CLAUDE_CODE_OAUTH_TOKEN=...

# Add one of these (new)
OPENAI_API_KEY=sk-...
# or CODEX_CODE_OAUTH_TOKEN=... (from Codex CLI login, e.g. `codex login --device-auth`)
# or CODEX_CONFIG_DIR=/path/to/codex/config
```

3. (Optional) Set a Codex model override:

```bash
AUTO_BUILD_MODEL=gpt-5.2-codex-xhigh
```

## 3) Verify Codex CLI Works

```bash
printf "Hello from Codex\n" | codex exec --json -m gpt-5.2-codex-xhigh -
```

You should see JSON output with a message event.

## 4) Run Auto-Codex

```bash
python auto-codex/run.py --spec 001
```

## Environment Variable Changes

- `CLAUDE_CODE_OAUTH_TOKEN` → removed (legacy Claude token)
- `OPENAI_API_KEY` → supported for Codex CLI
- `CODEX_CODE_OAUTH_TOKEN` → supported (OAuth token)
- `CODEX_CONFIG_DIR` → supported (Codex CLI config directory)
- `AUTO_BUILD_MODEL` → optional model override (default: `gpt-5.2-codex-xhigh`)

## API/Behavior Differences

- **Provider**: Claude SDK calls are replaced with Codex CLI subprocess calls.
- **Auth**: Use `OPENAI_API_KEY`, `CODEX_CODE_OAUTH_TOKEN`, or `CODEX_CONFIG_DIR`.
- **Execution**: Codex CLI runs as a local process (`codex exec --json`) with streamed JSON events.
- **Models**: Model IDs now use Codex-compatible names (default `gpt-5.2-codex-xhigh`).

## FAQ

**Q: Do I still need a Claude subscription?**
No. Codex CLI uses OpenAI credentials only.

**Q: Where do I put authentication?**
Set `OPENAI_API_KEY` or `CODEX_CODE_OAUTH_TOKEN` in `auto-codex/.env`, or export them in your shell. You can also set `CODEX_CONFIG_DIR` to point at an existing Codex CLI profile, or rely on the default `~/.codex` config directory.

**Q: Can I keep my old `.env` file?**
Yes, but remove `CLAUDE_CODE_OAUTH_TOKEN` and add one of `OPENAI_API_KEY`, `CODEX_CODE_OAUTH_TOKEN`, or `CODEX_CONFIG_DIR`.

**Q: How do I confirm the CLI is available?**
Run `codex --version` or the JSON test command above.
