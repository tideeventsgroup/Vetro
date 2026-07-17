# Vetro backend

API for the officer/licence/vetting record. Hono app that runs identically
locally (Node server) and in AWS (Lambda behind API Gateway) — same
`src/app.ts`, two thin entry points (`src/server.ts`, `src/lambda.ts`).

## Stack

- **Hono** — HTTP routing, works unchanged on Node and Lambda
- **Prisma** — schema in `prisma/schema.prisma`, targets Postgres (Aurora Serverless v2 in AWS, via RDS Proxy)
- **aws-jwt-verify** — validates Cognito access tokens (see `infra/lib/auth-stack.ts`)

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
| GET | `/officers?contractorId=` | List officers with licences + vetting |
| POST | `/officers` | Create officer |
| GET | `/officers/:id` | Full officer record |
| PATCH / DELETE | `/officers/:id` | |
| POST | `/officers/:officerId/licences` | Add SIA licence |
| PATCH | `/licences/:id` | |
| POST | `/officers/:officerId/vetting` | Add BS7858 vetting record |
| PATCH | `/vetting/:id` | |
| GET | `/dashboard/summary?contractorId=` | Status counts, powers the dashboard preview |
| GET | `/exports/officers.csv?contractorId=` | Audit-ready export |

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
