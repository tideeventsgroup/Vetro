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

## Multi-tenant

Each contractor is a tenant on its own subdomain — `clyde-coast.vetro.co.uk`,
`highland-guard.vetro.co.uk`. One app deployment, one API, one database
serve every tenant; there's no per-tenant infrastructure. Isolation is
enforced server-side (see `backend/README.md`'s "Multi-tenancy" section),
not just by which subdomain the app happens to be pointed at.

Locally, visit `http://<slug>.localhost:5173` to develop against a specific
tenant — `prisma/seed.ts` creates two (`clyde-coast`, `highland-guard`) so
you can see isolation between them without any DNS setup.

## Onboarding & roles

There's no public signup. A platform admin creates an organization (and its
first admin account); that org's admin invites teammates and invites
officers to a self-service portal where they submit their own vetting
details and documents for review — Vetro still never performs the BS7858
check itself. See `backend/README.md`'s "Onboarding & roles" for the full
flow and the Cognito role model behind it.
