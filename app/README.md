# Lunara Screening app

The product itself: the dashboard an org's admin/reviewer logs into to
invite candidates, review submitted documents, and export compliance
reports. Vite + React + TypeScript, styled from the same tokens as the
marketing site (`../src/styles/tokens.css`, imported directly by
`src/styles/app.css` rather than duplicated).

## Multi-tenancy

Each organisation gets a subdomain — `your-org.lunarascreening.co.uk`.
`src/lib/tenant.ts` reads the tenant slug straight off
`window.location.hostname` and `lib/api.ts` sends it as an `X-Lunara-Tenant`
header on every request. That header is a UI convenience, not the security
boundary — the backend only trusts it in local dev; in a real deployment it
derives the tenant from the signed-in user's Cognito ID token instead (see
`backend/README.md`).

Signing in doesn't need that slug up front, though: `/login` (and `/`,
`/signup`) are the tenant-agnostic routes; everything past sign-in lives
under `/:tenant`. `Login.tsx` authenticates first, then calls `GET
/organisations/me` — already scoped correctly server-side by the ID token's
`custom:contractor_id` claim, no tenant hint needed from the client — to
learn which slug to land on. Nobody has to already know or type their org's
URL just to log in.

`/candidates/:token` is the one fully public route: no tenant prefix, no
Cognito account — a candidate's own magic link (their `inviteToken`) is
what authorises `CandidateSelfService.tsx`, the same way it does on the
backend (`routes/candidatePublic.ts`).

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
`/etc/hosts` edit needed. `prisma/seed.ts` creates two organisations
(`acme-vetting`, `northgate`) so you can see isolation between them without
any DNS setup.

## Auth

`src/lib/auth.tsx` uses `amazon-cognito-identity-js` directly (not full
Amplify) against the user pool created in `infra/lib/auth-stack.ts`, and
reads the **ID** token (not the access token) since that's where Cognito
puts custom attributes like `custom:contractor_id`.

Every invited teammate (created via `AdminCreateUser`, see
`backend/README.md`'s "Onboarding & roles") starts in
`FORCE_CHANGE_PASSWORD` status, so its first login always hits Cognito's
`NEW_PASSWORD_REQUIRED` challenge instead of succeeding outright — a
self-serve `/signup` account never sees this, since it sets its real
password at signup time. `login()` rejects with `NewPasswordRequiredError`
(carrying the mid-challenge `CognitoUser`) rather than completing sign-in;
`Login.tsx` catches that specifically and swaps to a "set a new password"
form, finishing with `completeNewPassword`. A candidate has no Cognito
account at all, so none of this applies to `CandidateSelfService.tsx`.

## Pages

- **`Dashboard.tsx`** — the candidate table, colour-coded per
  `lib/status.ts`'s `worstCheckColour` (green = fully verified, amber =
  pending or expiring soon, red = missing/expired/rejected); invite a
  candidate, select rows for a bulk compliance-report export.
- **`CandidateDetail.tsx`** — one candidate's checks: review actions
  (verify/request more info/reject), the SIA register deep-link for
  admin-assisted licence verification, and their uploaded documents.
- **`RoleTypes.tsx`** — an org's configurable "which checks does this role
  need" templates, chosen automatically at invite time.
- **`Team.tsx`** / **`Settings.tsx`** / **`AuditLog.tsx`** / **`DataRequests.tsx`**
  — teammate invites (`ADMIN`/`REVIEWER`), org name and retention period,
  the audit trail, and the GDPR access/deletion queue.
- **`CandidateSelfService.tsx`** — the candidate-facing magic-link page:
  upload documents per check, enter SIA licence number/expiry, and raise a
  GDPR request. No sidebar, no Cognito account.
- **`ComplianceReport.tsx`** — a printable report (`window.print()` → save
  as PDF), single candidate or bulk via a `?ids=` query string from the
  Dashboard's row selection.

## What's here vs. not yet

- The full flow works against the real API and has been exercised in a
  browser: org signup → invite candidate → candidate self-service upload →
  admin review → dashboard colour coding → compliance report export → GDPR
  data request → resolve.
- Document upload (`uploadCandidateDocument` in `lib/api.ts`) is built —
  presigned-URL request, direct S3 PUT, confirm call — but the actual S3
  round-trip isn't verified end-to-end in local dev: it needs a deployed
  `DOCUMENTS_BUCKET`, which doesn't exist locally. Expect the upload step to
  500 in local dev; that's the backend correctly refusing to guess a bucket
  name, not a frontend bug.
- Tenant creation (`POST /organisations`) only works in `SKIP_AUTH` dev
  mode. Real onboarding — assigning `custom:contractor_id` to a Cognito user
  and creating their `Organisation` row — is an admin/ops action with no UI
  yet (see `infra/README.md`'s "Running migrations against the deployed
  database").
