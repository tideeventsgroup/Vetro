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
| `app/` | The product itself — the contractor-admin dashboard (Vite + React) |
| `infra/` | AWS CDK (TypeScript) app — serverless deploy of the backend |

See `backend/README.md`, `app/README.md`, and `infra/README.md` for how each
part runs and deploys.

## Running it locally

```bash
# 1. Postgres
sudo service postgresql start   # or: docker run -p 5432:5432 postgres:16

# 2. Backend
cd backend && cp .env.example .env && npm install
npm run prisma:migrate && npm run seed && npm run dev   # :3001

# 3. Dashboard app (separate terminal)
cd app && cp .env.example .env && npm install && npm run dev   # :5173
```

Both `.env.example` files default to a dev-only auth bypass
(`SKIP_AUTH`/`VITE_SKIP_AUTH`), so there's no Cognito pool to stand up just
to click around locally.
