# Migration Guide: Claude SDK → Codex CLI

This guide walks you through migrating Auto-Codex from the Claude SDK to the OpenAI Codex CLI.

## 1) Install Codex CLI

```bash
npm install -g @openai/codex-cli
codex --version
```

## 2) Update Environment Variables

1. Copy the example file if you have not already:

```bash
cd auto-claude
cp .env.example .env
```

2. Replace the old token with your OpenAI API key:

```bash
# Remove this (old)
# CLAUDE_CODE_OAUTH_TOKEN=...

# Add this (new)
OPENAI_API_KEY=sk-...
```

3. (Optional) Set a Codex model override:

```bash
AUTO_BUILD_MODEL=gpt-5.2-codex
```

## 3) Verify Codex CLI Works

```bash
printf "Hello from Codex\n" | codex exec --json -m gpt-5.2-codex -
```

You should see JSON output with a message event.

## 4) Run Auto-Codex

```bash
python auto-claude/run.py --spec 001
```

## Environment Variable Changes

- `CLAUDE_CODE_OAUTH_TOKEN` → removed
- `OPENAI_API_KEY` → required for Codex CLI
- `AUTO_BUILD_MODEL` → optional model override (default: `gpt-5.2-codex`)

## API/Behavior Differences

- **Provider**: Claude SDK calls are replaced with Codex CLI subprocess calls.
- **Auth**: OAuth token flow is removed; use `OPENAI_API_KEY`.
- **Execution**: Codex CLI runs as a local process (`codex exec --json`) with streamed JSON events.
- **Models**: Model IDs now use Codex-compatible names (default `gpt-5.2-codex`).

## FAQ

**Q: Do I still need a Claude subscription?**
No. Codex CLI uses OpenAI credentials only.

**Q: Where do I put the OpenAI API key?**
Set `OPENAI_API_KEY` in `auto-claude/.env` or export it in your shell.

**Q: Can I keep my old `.env` file?**
Yes, but remove `CLAUDE_CODE_OAUTH_TOKEN` and add `OPENAI_API_KEY`.

**Q: How do I confirm the CLI is available?**
Run `codex --version` or the JSON test command above.
