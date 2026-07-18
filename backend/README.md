# Vetro backend

API for the officer/licence/vetting record. Hono app that runs identically
locally (Node server) and in AWS (Lambda behind API Gateway) — same
`src/app.ts`, two thin entry points (`src/server.ts`, `src/lambda.ts`).

## Stack

- **Hono** — HTTP routing, works unchanged on Node and Lambda
- **Prisma** — schema in `prisma/schema.prisma`, targets Postgres (Aurora Serverless v2 in AWS, via RDS Proxy)
- **aws-jwt-verify** — validates Cognito ID tokens (see `infra/lib/auth-stack.ts`)

## Multi-tenancy

`Contractor.slug` is the tenant boundary — the subdomain a contractor's
dashboard lives at (`clyde-coast.vetro.co.uk`). Every tenant-scoped route is
mounted behind `requireContractor` (`src/lib/auth.ts`), which 403s unless a
tenant was resolved:

- **Real deployments**: the tenant comes from the Cognito ID token's
  `custom:contractor_id` claim (why `requireAuth` verifies the ID token, not
  the access token — custom attributes aren't on the access token unless you
  add a Pre Token Generation trigger, which felt like unneeded machinery
  here). A client cannot pick its own tenant; that claim is assigned when
  the contractor's account is set up.
- **Local dev (`SKIP_AUTH=true`)**: there's no token to read a claim from, so
  `requireAuth` trusts the `X-Vetro-Tenant` header instead — sent by the app
  based on whatever subdomain it's running on (see `app/src/lib/tenant.ts`).
  This header is *only* trusted in `SKIP_AUTH` mode; in a real deployment
  it's read once (into `tenantSlug`, for the dev-only tenant-creation route)
  but never used to authorize anything.

Every route handler filters by `contractorId`, and anything reached by ID
(a licence, a vetting record, a qualification, a document) checks its parent
officer's `contractorId` before returning or mutating it — a valid token for
tenant A gets a 404, not tenant B's data, for tenant B's records.

## Onboarding & roles

An organization gets created one of two ways; everything after that —
inviting teammates, inviting officers — is the same either way. Two Cognito
custom attributes on top of `custom:contractor_id` decide what an account
can do — `custom:role` (`ADMIN` | `OFFICER`) and `custom:officer_id` (only
set for `OFFICER` accounts) — plus a `PlatformAdmins` Cognito group for the
one action that isn't scoped to a tenant at all:

1. **Self-serve signup.** Cognito's own public sign-up (`selfSignUpEnabled`,
   `infra/lib/auth-stack.ts`) creates the bare account — email + password,
   nothing else. Custom attributes are deliberately **not** among the app
   client's `writeAttributes`, so the client can never set its own
   `custom:role`/`custom:contractor_id` at signup (or ever — see the comment
   in `auth-stack.ts`). Once that account is confirmed (email code) and
   signed in, `POST /signup/organization` (`src/routes/signup.ts`) creates
   the `Contractor` row and calls `AdminUpdateUserAttributes` to grant that
   *specific, already-authenticated* account `ADMIN` of the org it just
   created — gated only on the caller not already having a `contractorId`,
   so it can't be replayed against an existing account. This is the backend
   the redesigned login/signup page (`app/src/routes/Signup.tsx`) drives.
2. **A platform admin creates the organization on someone's behalf.** `POST
   /admin/organizations` (gated on `PlatformAdmins` group membership —
   `requirePlatformAdmin` in `src/lib/auth.ts`) creates the `Contractor` row
   and the org's first `ADMIN` Cognito account in one step
   (`src/routes/admin.ts`), via `AdminCreateUser` instead — useful for
   setting an org up without the customer going through signup themselves.

Both roll back the `Contractor` row if the Cognito call fails, rather than
leaving an org behind with no admin who can ever log into it.

3. **That org's admin invites teammates.** `POST /invitations`
   (`src/routes/invitations.ts`) creates another `ADMIN` account scoped to
   the same `contractor_id` — full access to the org's roster, same as the
   inviter.
4. **That org's admin invites officers to self-service.** `POST
   /officers/:id/invite` (`src/routes/officers.ts`) creates an `OFFICER`
   account with `custom:officer_id` set to that one `Officer` row — an
   officer's login can only ever reach their own record.

Both of those create the Cognito user via `AdminCreateUser`
(`src/lib/cognito.ts`), which lets Cognito's own built-in email service send
the temporary password — fine at onboarding volumes, no SES setup required.

The officer self-service portal (`/me/*`, gated by `requireOfficerSelf`) is
deliberately narrow: an officer can view their own record and submit their
own vetting details (address history, employment history, references,
consent) and documents. Vetro still never performs the BS7858 check itself —
what they submit lands as a `VettingSubmission` (`PENDING_REVIEW`), a
distinct model from the authoritative `VettingRecord` an admin still owns
and updates by hand after reviewing it. "Verified, not assumed" applies to
this flow the same as everywhere else: the officer's own claim about their
address history isn't the record until an admin has looked at it.

## Local development

```bash
docker run -d --name vetro-db -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=vetro postgres:16
cp .env.example .env
npm install
npm run prisma:migrate
npm run seed
npm run dev
```

The dev server listens on `http://localhost:3001` with `SKIP_AUTH=true` (set
in `.env.example`), so requests don't need a bearer token locally.

## Routes

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | Unauthenticated |
| GET | `/contractors/me` | The resolved tenant, or `null` (404) if none |
| POST | `/contractors` | Dev-only: creates a tenant for the current subdomain |
| POST | `/admin/organizations` | Platform-admin only — creates a `Contractor` + its first `ADMIN` account |
| POST | `/signup/organization` | Self-serve — creates a `Contractor` and grants the calling (already-signed-up) account `ADMIN` of it; 409s if the caller already belongs to one |
| POST | `/invitations` | Admin-only — invites a teammate as another `ADMIN` in the same tenant |
| GET | `/officers` | List officers with licences + vetting, scoped to tenant (admin-only) |
| POST | `/officers` | Create officer in the resolved tenant (admin-only) |
| GET | `/officers/:id` | Full officer record (admin-only) |
| PATCH / DELETE | `/officers/:id` | Admin-only |
| POST | `/officers/:id/invite` | Admin-only — invites that officer to the self-service portal |
| POST | `/officers/:officerId/licences` | Add SIA licence (admin-only) |
| PATCH | `/licences/:id` | Admin-only |
| POST | `/officers/:officerId/vetting` | Add BS7858 vetting record (admin-only) |
| PATCH | `/vetting/:id` | Admin-only |
| POST | `/officers/:officerId/qualifications` | Admin-only |
| PATCH / DELETE | `/qualifications/:id` | Admin-only |
| POST | `/officers/:officerId/documents/upload-url` | Returns a presigned S3 PUT URL (admin-only) |
| POST | `/officers/:officerId/documents` | Confirms an upload, creates the `Document` row (admin-only) |
| GET | `/documents/:id/download-url` | Returns a presigned S3 GET URL (admin-only) |
| DELETE | `/documents/:id` | Admin-only |
| GET | `/dashboard/summary` | Status counts, powers the dashboard preview (admin-only) |
| GET | `/exports/officers.csv` | Audit-ready export (admin-only) |
| GET | `/me/officer` | Officer self-service — own record, scoped by `custom:officer_id` |
| GET / POST | `/me/vetting-submissions` | Officer self-service — own submissions / submit new one |
| POST | `/me/documents/upload-url` | Officer self-service — same presigned flow, scoped to the caller |
| POST | `/me/documents` | Officer self-service |
| GET | `/me/documents/:id/download-url` | Officer self-service |
| GET | `/vetting-submissions` | Admin-only — the review queue behind `/me/vetting-submissions`; optional `?status=` filter |
| PATCH | `/vetting-submissions/:id` | Admin-only — approve (creates a `VettingRecord`) or reject; 409s if already reviewed |
| PATCH | `/contractors/me` | Admin-only — renames the org; slug stays immutable |
| GET | `/team` | Admin-only — this org's `ADMIN` accounts |
| DELETE | `/team/:username` | Admin-only — removes a teammate; 404s if they're not in this org, 400s on self-removal |
| GET | `/audit-log` | Admin-only — most recent 200 `AuditLogEntry` rows for this tenant |
| GET | `/sites` | Admin-only — this tenant's sites |
| GET | `/sites/:id` | Admin-only — site detail incl. its last 50 shifts |
| POST | `/sites` | Admin-only — create a site |
| PATCH / DELETE | `/sites/:id` | Admin-only |
| POST | `/sites/:id/invite-client` | Admin-only — creates a `CLIENT` Cognito account scoped to that one site (`custom:site_id`) |
| GET | `/shifts` | Admin-only — optional `?siteId=`/`?from=`/`?to=` filters |
| POST | `/shifts` | Admin-only — validates `siteId`/`officerId` belong to the tenant |
| PATCH / DELETE | `/shifts/:id` | Admin-only — reassign, reschedule, or change status |
| GET | `/client/site` | Client self-service — the caller's own site, scoped by `custom:site_id` |
| GET | `/client/shifts` | Client self-service — shifts scheduled at their own site |
| PATCH | `/client/shifts/:id/confirm` | Client self-service — confirms a shift as `COMPLETED`/`MISSED`/`LATE` with optional `incidentNotes`, stamps `clientConfirmedAt` |
| GET | `/reports/sites` | Admin-only — per-site rollup: shift counts by status, officer count, officers with a non-`ACTIVE` licence/vetting record |

All of the above except `/health` and `/contractors/me`+`/contractors`
require a resolved tenant (403 otherwise) — see "Multi-tenancy" above. Routes
marked admin-only additionally 403 an `OFFICER` or `CLIENT` login
(`requireAdmin`); `/me/*` routes require `requireOfficerSelf`, `/client/*`
routes require `requireClientSelf` — see "Onboarding & roles".

All writes go through `src/lib/audit.ts` into `AuditLogEntry` — that table is
the answer to "prove this happened" for an ACS inspector, and `/audit-log`
above is how an org's own admin reads it back. Entries carry a `contractorId`
so they can be scoped per-tenant; rows from before that column existed show
with no tenant attributed.

## Scheduling, sites, and the client portal

A third custom attribute, `custom:role: CLIENT` (plus `custom:site_id`),
covers the other half of TimeGate+-style workforce management this session
added on top of the compliance tracking Vetro already did — site/contract
tracking, shift scheduling, and client sign-off, without taking on payroll or
automated shift-matching (out of scope; see the `Site`/`Shift` models in
`prisma/schema.prisma`):

- **`Site`** — one of a contractor's client locations/contracts. `POST
  /sites/:id/invite-client` (`src/routes/sites.ts`) creates a Cognito account
  with `custom:role=CLIENT` and `custom:site_id` set to that one site — like
  an `OFFICER` login, a `CLIENT` login can only ever reach its own scope
  (`requireClientSelf`, `src/lib/auth.ts`).
- **`Shift`** — an officer assigned to a site for a time window
  (`src/routes/shifts.ts`, admin-only). `status` starts `SCHEDULED` and moves
  to `CONFIRMED`/`COMPLETED`/`MISSED`/`LATE`.
- **The client portal** (`/client/*`, `src/routes/client.ts`) is that
  contact's confirmation step — TimeGate+'s "client signoff" idea. They see
  shifts scheduled at their own site and confirm what actually happened
  (`COMPLETED`/`MISSED`/`LATE`, with `incidentNotes` for anything but a clean
  completion); confirming stamps `clientConfirmedAt`. They never see the
  contractor's roster, other sites, or officer compliance data — the client
  portal answers "did the guard turn up," nothing else.
- **`/reports/sites`** (`src/routes/reports.ts`) is the exception-based
  rollup TimeGate+ calls out explicitly: shift counts by status per site,
  officer count, and how many of those officers currently have a non-`ACTIVE`
  licence or vetting record — the same "N submissions awaiting review" idea
  on the dashboard, one level up, per contract.

## Expiry checking

`src/jobs/checkExpiries.ts` is a separate Lambda entry point (deployed by
`infra/lib/schedule-stack.ts` on a daily EventBridge rule). It recomputes each
licence/vetting record's status from its stored expiry date using the same
30-day amber threshold as the brand guidelines.

**Not yet built:** an actual lookup against the public SIA register. Today,
expiry dates are entered when a licence/vetting record is created and the job
only tracks time against them. Wiring in the real register check is the next
piece of work before "checked automatically" is fully true — plug it in
ahead of the status recompute in `checkExpiries.ts`, updating
`licenceNumber`/`status` from the lookup result instead of only the clock.
