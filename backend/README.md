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
| GET | `/officers` | List officers with licences + vetting, scoped to tenant |
| POST | `/officers` | Create officer in the resolved tenant |
| GET | `/officers/:id` | Full officer record |
| PATCH / DELETE | `/officers/:id` | |
| POST | `/officers/:officerId/licences` | Add SIA licence |
| PATCH | `/licences/:id` | |
| POST | `/officers/:officerId/vetting` | Add BS7858 vetting record |
| PATCH | `/vetting/:id` | |
| POST | `/officers/:officerId/qualifications` | |
| PATCH / DELETE | `/qualifications/:id` | |
| POST | `/officers/:officerId/documents/upload-url` | Returns a presigned S3 PUT URL |
| POST | `/officers/:officerId/documents` | Confirms an upload, creates the `Document` row |
| GET | `/documents/:id/download-url` | Returns a presigned S3 GET URL |
| DELETE | `/documents/:id` | |
| GET | `/dashboard/summary` | Status counts, powers the dashboard preview |
| GET | `/exports/officers.csv` | Audit-ready export |

All of the above except `/health` and `/contractors/me`+`/contractors`
require a resolved tenant (403 otherwise) — see "Multi-tenancy" above.

All writes go through `src/lib/audit.ts` into `AuditLogEntry` — that table is
the answer to "prove this happened" for an ACS inspector.

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
