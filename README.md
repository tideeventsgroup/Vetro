# Lunara Screening

Workforce compliance, tracked clearly. A UK-focused vetting and compliance
workflow layer for small/mid-size organisations: invite a candidate, they
upload their own documents through a branded self-service link, you review
and verify what's verifiable, and export a clean compliance report — one
record per person, not a folder of emails.

Lunara Screening is a front end and workflow layer, not a statutory
screening provider. It is not a DBS Registered Body or Umbrella Body — DBS,
PVG, and Disclosure Scotland checks require an accredited partner and are
not performed by this product today; every page that could be confused with
one carries that disclaimer directly. What it does check itself: SIA
licence validity (admin-assisted, cross-checked against the public Register
of Licence Holders — there's no public API to automate this), plus
first aid, right to work, ID document, and training records tracked with
expiry dates and human review.

## Layout

| Path | What it is |
|---|---|
| `docs/BRAND_GUIDELINES.md` | Brand identity — palette, type, voice/tone, do's and don'ts |
| `index.html`, `src/styles/` | Marketing landing page applying the brand system |
| `backend/` | Hono API + Prisma schema — organisations, candidates, checks, documents, audit log |
| `app/` | The product itself — the org admin dashboard (Vite + React) |
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

Each organisation is a tenant, one app deployment/API/database serving all
of them — there's no per-tenant infrastructure. With a custom domain, that's
a subdomain each (`your-org.lunarascreening.co.uk`); until then, every route
instead nests under `/:tenant` (`.../your-org`) so this still works today
from a single CloudFront default domain (see `app/src/lib/tenant.ts` —
subdomain takes priority automatically once one exists). Either way,
isolation is enforced server-side (see `backend/README.md`'s "Multi-tenancy"
section), not just by which URL the app happens to be pointed at.

## Onboarding & roles

Anyone can sign up and create their own organisation (`/signup`) — Cognito
handles the raw account (email + password, email-code verified), then the
backend grants that specific account `ADMIN` of the org it just created. An
admin invites teammates as `ADMIN` or `REVIEWER` (candidates/review queue
only), configures role types (which checks each kind of role needs), and
invites candidates by email — each candidate gets a magic link, no account
of their own, to upload their documents and enter check details. Every
status change and document view is written to the audit log; a candidate
can request a copy of their own data or its deletion at any time through
their own link, resolved by an admin (`routes/dataRequests.ts`).
