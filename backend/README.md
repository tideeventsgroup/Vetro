# Lunara Screening backend

API for the candidate/check/document compliance record. Hono app that runs
identically locally (Node server) and in AWS (Lambda behind API Gateway) —
same `src/app.ts`, two thin entry points (`src/server.ts`, `src/lambda.ts`).

## Stack

- **Hono** — HTTP routing, works unchanged on Node and Lambda
- **Prisma** — schema in `prisma/schema.prisma`, targets Postgres (Aurora Serverless v2 in AWS, via RDS Proxy)
- **aws-jwt-verify** — validates Cognito ID tokens (see `infra/lib/auth-stack.ts`)

## Multi-tenancy

`Organisation.slug` is the tenant boundary — the subdomain an org's
dashboard lives at (`your-org.lunarascreening.co.uk`). Every tenant-scoped
route is mounted behind `requireOrganisation` (`src/lib/auth.ts`), which
403s unless a tenant was resolved:

- **Real deployments**: the tenant comes from the Cognito ID token's
  `custom:contractor_id` claim — the attribute name predates this rename and
  can't change without recreating the Cognito User Pool, so it stays as-is
  at the wire level even though the app calls this `organisationId`
  everywhere (why `requireAuth` verifies the ID token, not the access
  token — custom attributes aren't on the access token unless you add a Pre
  Token Generation trigger). A client cannot pick its own tenant; that claim
  is assigned when the org's account is set up.
- **Local dev (`SKIP_AUTH=true`)**: there's no token to read a claim from,
  so `requireAuth` trusts the `X-Lunara-Tenant` header instead — sent by the
  app based on whatever subdomain it's running on (see `app/src/lib/tenant.ts`).
  This header is *only* trusted in `SKIP_AUTH` mode; in a real deployment
  it's read once (into `tenantSlug`, for the dev-only tenant-creation route)
  but never used to authorize anything.

Every route handler filters by `organisationId`, and anything reached by ID
(a check, a document, a data request) checks its parent candidate's
`organisationId` before returning or mutating it — a valid token for tenant
A gets a 404, not tenant B's data, for tenant B's records.

## Onboarding & roles

An organisation gets created one of two ways; everything after that —
inviting teammates, inviting candidates — is the same either way. Two
Cognito custom attributes on top of `custom:contractor_id` decide what an
account can do — `custom:role` (`ADMIN` | `REVIEWER`) — plus a
`PlatformAdmins` Cognito group for the one action that isn't scoped to a
tenant at all:

1. **Self-serve signup.** Cognito's own public sign-up (`selfSignUpEnabled`,
   `infra/lib/auth-stack.ts`) creates the bare account — email + password,
   nothing else. Custom attributes are deliberately **not** among the app
   client's `writeAttributes`, so the client can never set its own
   `custom:role`/`custom:contractor_id` at signup (or ever — see the comment
   in `auth-stack.ts`). Once that account is confirmed (email code) and
   signed in, `POST /signup/organisation` (`src/routes/signup.ts`) creates
   the `Organisation` row and calls `AdminUpdateUserAttributes` to grant that
   *specific, already-authenticated* account `ADMIN` of the org it just
   created — gated only on the caller not already having an
   `organisationId`, so it can't be replayed against an existing account.
2. **A platform admin creates the organisation on someone's behalf.** `POST
   /admin/organisations` (gated on `PlatformAdmins` group membership —
   `requirePlatformAdmin` in `src/lib/auth.ts`) creates the `Organisation`
   row and the org's first `ADMIN` Cognito account in one step
   (`src/routes/admin.ts`), via `AdminCreateUser` instead — useful for
   setting an org up without the customer going through signup themselves.

Both roll back the `Organisation` row if the Cognito call fails, rather than
leaving an org behind with no admin who can ever log into it.

3. **That org's admin invites teammates.** `POST /invitations`
   (`src/routes/invitations.ts`) creates another account scoped to the same
   `contractor_id`, as `ADMIN` (full access) or `REVIEWER` (candidates and
   the review queue only — see `requireReviewer` in `src/lib/auth.ts`).
4. **That org's admin invites a candidate.** `POST /candidates`
   (`src/routes/candidates.ts`) creates a `Candidate` row plus one `Check`
   row per required check on their `RoleType`, and generates an unguessable
   `inviteToken` — a candidate has no Cognito account; that token, sent as a
   magic link, is the only thing standing in for one (`src/routes/candidatePublic.ts`).

Invited teammates are created via `AdminCreateUser`
(`src/lib/cognito.ts`), which also asks Cognito's own built-in email service
to send the temporary password — no SES setup required, but that service is
hard-capped at 50 emails/day for the whole pool with no way to raise it
short of moving to SES. Email is therefore not the only way the invitee
gets their password: `createCognitoUser` generates it itself (matching the
pool's password policy) and `/invitations` returns it in the response, so
the inviting admin can hand it over directly if the email doesn't arrive.
A candidate invite has no Cognito email step at all — their magic link is
returned directly in the `POST /candidates` response for the admin to share.

When a teammate invite email *does* go out, Cognito's default text is a
generic "here's your username and temporary password" with no mention of
Lunara Screening, which org invited them, or where to sign in. Fixing that
doesn't need SES: a `CustomMessage` Lambda trigger
(`infra/lib/auth-stack.ts`'s `CustomMessageFunction`, handler in
`src/triggers/customMessage.ts`) rewrites the email's subject/body for
`AdminCreateUser` invites specifically, filling in the org's name and a
sign-in link. Both arrive via `ClientMetadata` on the `AdminCreateUserCommand`
call (`buildInviteClientMetadata` in `src/lib/cognito.ts`) rather than a DB
lookup inside the trigger — it needs no VPC/DB access of its own.

The candidate self-service form (`routes/candidatePublic.ts`, fronted by
`app/src/routes/CandidateSelfService.tsx`) is deliberately narrow: a
candidate can view their own record, upload documents against each required
check, enter check-specific details (an SIA licence number, an expiry
date), and raise a GDPR access or deletion request. Lunara Screening still
never performs a DBS/PVG/Disclosure Scotland check itself, and doesn't
verify SIA licences automatically either — what a candidate submits moves a
`Check` to `PENDING`, a distinct state from `VERIFIED`, which only an
admin/reviewer sets by hand after reviewing it (and, for `SIA_LICENCE`,
cross-checking the licence number against the public Register of Licence
Holders themselves — there's no public API to automate that lookup).
"Verified, not assumed" applies to this flow the same as everywhere else.

## Local development

```bash
docker run -d --name lunara-db -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=vetro postgres:16
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
| GET | `/organisations/me` | The resolved tenant, or `null` (404) if none |
| POST | `/organisations` | Dev-only: creates a tenant for the current subdomain |
| PATCH | `/organisations/me` | Admin-only — renames the org and/or sets `retentionDays`; slug stays immutable |
| POST | `/admin/organisations` | Platform-admin only — creates an `Organisation` + its first `ADMIN` account |
| POST | `/signup/organisation` | Self-serve — creates an `Organisation` and grants the calling (already-signed-up) account `ADMIN` of it; 409s if the caller already belongs to one |
| POST | `/invitations` | Admin-only — invites a teammate as `ADMIN` or `REVIEWER` in the same tenant |
| GET | `/team` | Admin-only — this org's `ADMIN`/`REVIEWER` accounts |
| DELETE | `/team/:username` | Admin-only — removes a teammate; 404s if they're not in this org, 400s on self-removal |
| GET / POST | `/role-types` | Admin-only — an org's configurable "which checks does this job need" templates |
| PATCH / DELETE | `/role-types/:id` | Admin-only |
| GET | `/candidates` | Admin/reviewer — list candidates with their role type and checks |
| GET | `/candidates/:id` | Admin/reviewer — full candidate record incl. documents |
| POST | `/candidates` | Admin/reviewer — invite a candidate; creates one `Check` per their role type's required checks |
| DELETE | `/candidates/:id` | Admin/reviewer — cascades onto their checks and documents |
| PATCH | `/candidates/:id/checks/:checkId` | Admin/reviewer — the review queue: set `status`/`notes`/`expiryDate`/`licenceNumber` |
| GET | `/candidates/:id/checks/:checkId/documents/:docId/download-url` | Admin/reviewer — presigned S3 GET URL; logs a `document.viewed` audit entry |
| GET | `/public/candidates/:token` | Public — a candidate's own record via their magic link, no Cognito account |
| POST | `/public/candidates/:token/checks/:checkId/upload-url` | Public — presigned S3 PUT URL for that check |
| POST | `/public/candidates/:token/checks/:checkId/documents` | Public — confirms an upload, moves the check to `PENDING` |
| POST | `/public/candidates/:token/submit` | Public — marks the candidate `SUBMITTED` |
| POST | `/public/candidates/:token/data-requests` | Public — candidate raises a GDPR `ACCESS` or `DELETE` request |
| GET | `/data-requests` | Admin-only — this org's GDPR requests |
| POST | `/data-requests/:id/resolve` | Admin-only — marks resolved; actually deletes the candidate for a `DELETE` request |
| GET | `/audit-log` | Admin/reviewer — most recent 200 `AuditLogEntry` rows for this tenant |

All of the above except `/health` and `/organisations/me`+`/organisations`
require a resolved tenant (403 otherwise) — see "Multi-tenancy" above.
`/candidates/*` accepts `ADMIN` or `REVIEWER` (`requireReviewer`); everything
else tenant-scoped is `ADMIN`-only (`requireAdmin`); `/public/candidates/*`
routes need neither — see "Onboarding & roles".

All writes go through `src/lib/audit.ts` into `AuditLogEntry` — that table is
the answer to "prove this happened" for a client due-diligence request, and
`/audit-log` above is how an org's own admin reads it back. Status changes,
document views, and GDPR requests are all recorded, per the brief's
requirement that the audit trail be a core feature, not an afterthought.

## Expiry and retention checking

`src/jobs/checkExpiries.ts` is a separate Lambda entry point (deployed by
`infra/lib/schedule-stack.ts` on a daily EventBridge rule). It does two
things: flips any `VERIFIED` check whose `expiryDate` has passed to
`EXPIRED`, and flags candidates older than their organisation's own
`retentionDays` for retention review — via an `AuditLogEntry`, not an
automatic delete, so a human is always in the loop for GDPR-driven cleanup.

**Not yet built:** an automated lookup against the public SIA register —
there isn't one to automate against (only a session-cookie-protected web
form exists, see `src/routes/candidates.ts`'s comments). SIA licence
verification is deliberately admin-assisted: an admin opens the official
register in a new tab, cross-checks the licence number themselves, and
confirms the result back in the review queue.
