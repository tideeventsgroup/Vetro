# Vetro

Scotland's Security Workforce, Verified. A compliance record for Scottish
security contractors — SIA licence status, BS7858 vetting, and
qualifications held in one auditable place, checked automatically instead
of chased manually — plus site/contract tracking, shift scheduling, and
client sign-off, so a contract's coverage and its compliance risk live in
the same place. Built by Tide Events Group Scotland.

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

Each contractor is a tenant, one app deployment/API/database serving all of
them — there's no per-tenant infrastructure. With a custom domain, that's a
subdomain each (`clyde-coast.vetro.co.uk`, `highland-guard.vetro.co.uk`); until
`vetro.com` is in hand, every route instead nests under `/:tenant`
(`.../clyde-coast`, `.../highland-guard`) so this still works today from a
single CloudFront default domain (see `app/src/lib/tenant.ts` — subdomain
takes priority automatically once one exists). Either way, isolation is
enforced server-side (see `backend/README.md`'s "Multi-tenancy" section), not
just by which URL the app happens to be pointed at.

Locally, visit `http://localhost:5173/<slug>` (or `http://<slug>.localhost:5173`
to exercise the subdomain path) to develop against a specific tenant —
`prisma/seed.ts` creates two (`clyde-coast`, `highland-guard`) so you can see
isolation between them without any DNS setup.

## Onboarding & roles

Anyone can sign up and create their own organization (`/signup`) — Cognito
handles the raw account (email + password, email-code verified), then the
backend grants that specific account `ADMIN` of the org it just created. A
platform admin can also create an org on someone's behalf as an alternative
entry point. Either way, that org's admin invites teammates and invites
officers to a self-service portal where they submit their own vetting
details and documents for review — Vetro still never performs the BS7858
check itself. A third role, `CLIENT`, scopes a login to one site instead of
one officer — the contact at that location confirming shifts actually
happened. See `backend/README.md`'s "Onboarding & roles" and "Scheduling,
sites, and the client portal" for the full flow and the Cognito role model
behind it.
