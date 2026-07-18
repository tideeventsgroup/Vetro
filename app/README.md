# Vetro app

The product itself: the dashboard a contractor's office manager logs into
to see who's cleared to work. Vite + React + TypeScript, styled from the
same tokens as the marketing site (`../src/styles/tokens.css`, imported
directly by `src/styles/app.css` rather than duplicated).

## Multi-tenancy

Each contractor gets a subdomain — `clyde-coast.vetro.co.uk`. `src/lib/
tenant.ts` reads the tenant slug straight off `window.location.hostname` and
`lib/api.ts` sends it as an `X-Vetro-Tenant` header on every request. That
header is a UI convenience, not the security boundary — the backend only
trusts it in local dev; in a real deployment it derives the tenant from the
signed-in user's Cognito ID token instead (see `backend/README.md`).

## Local development

```bash
cp .env.example .env
npm install
npm run dev
```

Requires `../backend` running (see `../backend/README.md`). With
`VITE_SKIP_AUTH=true` (the `.env.example` default) the login screen is
skipped, and `VITE_DEV_TENANT_SLUG` stands in for a subdomain since plain
`localhost` doesn't have one.

To develop against a **specific** tenant, or to see two tenants side by
side, visit the app at `http://<slug>.localhost:5173` instead — modern
browsers resolve any `*.localhost` hostname to loopback natively, no
`/etc/hosts` edit needed. `http://clyde-coast.localhost:5173` and
`http://highland-guard.localhost:5173` are two different, isolated rosters
against the same running dev server (both tenants are in `prisma/seed.ts`).

## Auth

`src/lib/auth.tsx` uses `amazon-cognito-identity-js` directly (not full
Amplify) against the user pool created in `infra/lib/auth-stack.ts`, and
reads the **ID** token (not the access token) since that's where Cognito
puts custom attributes like `custom:contractor_id`. Real login has not been
exercised end-to-end in this repo yet — that requires an actual deployed
user pool with a user in it and that attribute set — only the
`VITE_SKIP_AUTH` path has been.

## What's here vs. not yet

- Officer roster, officer detail, adding officers/licences/vetting/
  qualification records, and the CSV export all work against the real API
  — verified against a real Postgres in a real browser, including tenant
  isolation between two different subdomains.
- Document upload (`src/components/DocumentsSection.tsx`) is built —
  presigned-URL request, direct S3 PUT, confirm call — but **not verified
  end-to-end**: it needs a deployed `DOCUMENTS_BUCKET`, which doesn't exist
  locally. Expect it to 500 in local dev; that's the backend correctly
  refusing to guess a bucket name, not a frontend bug.
- Tenant creation (`POST /contractors`) only works in `SKIP_AUTH` dev mode.
  Real onboarding — assigning `custom:contractor_id` to a Cognito user and
  creating their `Contractor` row — is an admin/ops action with no UI yet.
