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

Signing in doesn't need that slug up front, though: `/login` (and `/`,
`/signup`) are the three tenant-agnostic routes; everything past sign-in
lives under `/:tenant`. `Login.tsx` authenticates first, then calls `GET
/contractors/me` — already scoped correctly server-side by the ID token's
`custom:contractor_id` claim, no tenant hint needed from the client — to
learn which slug to land on, redirecting role-appropriately
(`/{slug}`/`/{slug}/portal`/`/{slug}/client`). Nobody has to already know or
type their org's URL just to log in.

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
puts custom attributes like `custom:contractor_id`.

Every invited account (teammate/officer/client — all created via
`AdminCreateUser`, see `backend/README.md`'s "Onboarding & roles") starts in
`FORCE_CHANGE_PASSWORD` status, so its first login always hits Cognito's
`NEW_PASSWORD_REQUIRED` challenge instead of succeeding outright — a
self-serve `/signup` account never sees this, since it sets its real
password at signup time. `login()` rejects with `NewPasswordRequiredError`
(carrying the mid-challenge `CognitoUser`) rather than completing sign-in;
`Login.tsx` catches that specifically and swaps to a "set a new password"
form, finishing with `completeNewPassword`.

## Visual design

The dashboard's own look — distinct from the marketing site's — takes
concrete cues from TimeGate+ (a real workforce-management product for the
same security/cleaning industry; researched via its actual App Store
screenshots, not just marketing copy, since neither is reachable through a
browser in this environment): a dark navy-to-teal diagonal gradient hero
banner behind every page's title (`.page-header` in `app.css`, applied
consistently, not per-page), stat tiles that visually float across the
hero's bottom edge on the Dashboard specifically (negative `margin-top` on
`.summary-grid`), and a full-width rounded pill for the sign-in/sign-up
submit button (`.btn-pill`) rather than every button in the app. Status is
colour + text together everywhere (`StatusBadge.tsx`'s `ShiftStatusBadge`,
`ShiftMixBar.tsx`) — TimeGate's own list rows pair a coloured dot with the
status word rather than colour alone, and that pattern held up under the
`dataviz` skill's palette validator (the five status colours fail a
categorical-palette CVD check on lightness/chroma grounds in isolation, but
pass once every occurrence carries a text label, never just colour).
`components/SidebarIdentity.tsx` shows the org name and the signed-in
account's email/role under the (now much bigger) logo, fetched via `GET
/contractors/me` the same way `Login.tsx`'s post-auth redirect already does.

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
