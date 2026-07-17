# Vetro

Scotland's Security Workforce, Verified. A compliance record for Scottish
security contractors — SIA licence status, BS7858 vetting, and
qualifications held in one auditable place, checked automatically instead
of chased manually. Built by Tide Events Group Scotland.

## Layout

| Path | What it is |
|---|---|
| `docs/BRAND_GUIDELINES.md` | Brand v1.0 — palette, type, voice/tone, do's and don'ts |
| `index.html`, `src/styles/` | Marketing landing page applying the brand system |
| `backend/` | Hono API + Prisma schema — the officer/licence/vetting record itself |
| `infra/` | AWS CDK (TypeScript) app — serverless deploy of the backend |

See `backend/README.md` and `infra/README.md` for how each half runs and deploys.
