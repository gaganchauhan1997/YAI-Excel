# Security Policy

## Reporting a vulnerability

If you discover a security issue in YAI-Excel — please **do not open a public GitHub issue**.

Instead, email **security@hackknow.com** (or, if that bounces, open a *private* security advisory at <https://github.com/gaganchauhan1997/YAI-Excel/security/advisories/new>).

Include:
- A description of the issue
- Steps to reproduce (or a proof-of-concept)
- The affected version / commit
- Your suggested fix, if any

We aim to:
- Acknowledge within **48 hours**
- Triage and confirm within **5 business days**
- Patch high-severity issues within **14 days**
- Credit you publicly (if you'd like) once the fix is shipped

## Supported versions

| Version | Supported |
|---------|:---------:|
| 1.2.x   | ✅ |
| 1.1.x   | ✅ |
| 1.0.x   | ❌ |

## Scope

In-scope:
- The YAI-Excel backend (`backend/`)
- The YAI-Excel frontend (`frontend/`)
- The deploy configuration (`docker-compose.yml`, `fly.toml`, `frontend/wrangler.toml`)

Out-of-scope:
- Third-party AI providers (Gemini, Groq, OpenAI, Anthropic) — please report to those vendors
- Self-hosted deployments where the operator has modified default secrets / CORS

## Operating safely

- **Never commit `.env` files** — `.gitignore` already excludes them.
- **Never paste credentials into chat or issues** — even "test" credentials. If you do, treat them as compromised and rotate immediately.
- Store secrets in **Fly secrets** (`fly secrets set`) for the backend and **Cloudflare Pages environment variables** for the frontend. Both are encrypted at rest.
- Rotate the AI API keys every 90 days at minimum.
- If you fork the project, **revoke any inherited tokens** before redeploying.
