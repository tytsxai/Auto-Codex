# Security Policy

## Reporting a Vulnerability

Please do not open public issues for suspected security vulnerabilities.

- Email: security@autocodex.local (replace with your real address)
- Include: affected version, reproduction steps, impact, and any logs (redact secrets)

## Supported Versions

This project is a desktop app + local services. Only the latest released version is supported.

## Security Baseline (Production)

- Never commit secrets: keep API keys in `.env` files (gitignored) or your OS secret manager.
- Use least-privilege keys:
  - OpenAI: restrict key usage to required projects/environments.
  - Linear/GitHub: minimize scopes; rotate keys on staff changes.
- Keep dependencies up to date (see `.github/dependabot.yml`).
- Prefer pinned Docker image tags for production deployments; avoid `:latest`.

## Operational Guidance

See `guides/OPERATIONS.md` for backup/restore, log collection, and incident response basics.

