# Vetro infra

AWS CDK (TypeScript) app for the serverless deployment: API Gateway + Lambda
in front of the Hono app in `../backend`, Aurora Serverless v2 Postgres
behind RDS Proxy, S3 for uploaded documents, Cognito for contractor-admin
logins, and an EventBridge rule driving the daily expiry check.

## Stacks

| Stack | Contains |
|---|---|
| `VetroNetworkStack` | VPC, 1 NAT gateway, public/private/isolated subnets |
| `VetroDataStack` | Aurora Serverless v2 Postgres cluster, RDS Proxy, S3 documents bucket |
| `VetroAuthStack` | Cognito user pool + client for contractor admins, `custom:contractor_id` attribute |
| `VetroApiStack` | Lambda (bundles `backend/src/lambda.ts`) behind an HTTP API; adds `api.{domainName}` if configured |
| `VetroScheduleStack` | Daily EventBridge rule → Lambda (bundles `backend/src/jobs/checkExpiries.ts`) |
| `VetroMigrateStack` | One-off ops Lambda (bundles `backend/src/jobs/migrate.ts`) — applies migrations and can bootstrap a tenant, invoked by hand |
| `VetroDomainStack` | *(opt-in, us-east-1)* Wildcard ACM cert for `*.{domainName}` |
| `VetroFrontendStack` | *(opt-in, us-east-1)* S3 + CloudFront serving `app/dist`, aliased to `*.{domainName}` |

## Running migrations against the deployed database

Aurora sits in an isolated private subnet — nothing outside the VPC can
reach it, including a dev machine running `prisma migrate deploy`.
`VetroMigrateStack`'s Lambda runs inside the VPC instead:

```bash
aws lambda invoke --function-name <MigrateFunctionName from the stack output> \
  --cli-binary-format raw-in-base64-out result.json
cat result.json
```

To also create the first tenant (no admin UI for this yet — see
`backend/README.md`'s "Multi-tenancy"), pass a payload:

```bash
echo '{"bootstrapContractor":{"name":"Clyde Coast Security Ltd","slug":"clyde-coast"}}' > payload.json
aws lambda invoke --function-name <MigrateFunctionName> \
  --cli-binary-format raw-in-base64-out --payload file://payload.json result.json
```

Assigning that tenant to a real login is then an admin action against
Cognito directly:

```bash
aws cognito-idp admin-create-user --user-pool-id <pool id> --username <email> \
  --user-attributes Name=email,Value=<email> Name=email_verified,Value=true \
    Name=custom:contractor_id,Value=<contractor id from bootstrap>
aws cognito-idp admin-set-user-password --user-pool-id <pool id> --username <email> \
  --password <temp password> --permanent
```

## Custom domains (`*.vetro.co.uk`, `api.vetro.co.uk`)

Opt-in, via CDK context — without it every stack still deploys, just on the
plain CloudFront/API Gateway URLs:

```bash
npx cdk deploy --all -c domainName=vetro.co.uk -c hostedZoneId=Z0123456789ABC
```

The hosted zone must already exist (this app points records at it, it
doesn't register the domain or create the zone). `VetroDomainStack` and
`VetroFrontendStack` only get instantiated when both `domainName` and
`hostedZoneId` are supplied — `bin/vetro.ts` checks for both before adding
them to the app.

One S3 bucket and one CloudFront distribution serve every tenant — there's
no per-tenant infrastructure. The wildcard alias (`*.vetro.co.uk`) means
every subdomain resolves to the same distribution and the same static
build; the app itself reads which tenant it's running as from
`window.location.hostname` (`app/src/lib/tenant.ts`), and the API enforces
isolation per-request from the caller's identity (`backend/README.md`'s
"Multi-tenancy" section). Adding a tenant is a `Contractor` row and a DNS
wildcard match — no deploy required.

`VetroDomainStack` deploys to **us-east-1** regardless of the main app
region — a hard CloudFront requirement for the certificate, not a Vetro
choice. `VetroFrontendStack` follows it there for the same reason (no
per-tenant resources means no reason for it to be anywhere else). The API's
own custom domain cert (`api.{domainName}`) is regional and lives alongside
`VetroApiStack` instead, since API Gateway (unlike CloudFront) needs its
cert in the API's own region.

`VetroFrontendStack` deploys whatever is currently built at `app/dist` — run
`npm run build` in `app/` before `cdk deploy` picks it up; there's no build
step wired into the CDK deploy itself yet.

## Before deploying

1. `npm install` in both `infra/` and `backend/`.
2. `cd ../backend && npm run prisma:generate` — the API and schedule Lambdas
   bundle `backend/src/lambda.ts` / `backend/src/jobs/checkExpiries.ts`
   directly (see the `externalModules` note in `lib/api-stack.ts`), so the
   generated Prisma client needs to exist on disk first; esbuild bundling
   doesn't run `prisma generate` for you.
3. If deploying with a custom domain: `cd ../app && npm run build`.
4. `npx cdk bootstrap aws://<account>/<region>` once per account/region —
   and once for `us-east-1` too if using a custom domain and the main
   region isn't already us-east-1.

## Deploy

```bash
npm run diff     # review changes
npm run deploy    # cdk deploy --all
```

## Verified vs. not

`VetroNetworkStack`, `VetroDataStack`, `VetroAuthStack`, `VetroApiStack`,
`VetroScheduleStack`, and `VetroMigrateStack` are deployed for real, in
Tide Events Group's actual AWS account (589389426290, eu-west-2), alongside
the existing NexTix stacks (verified untouched — every change was purely
additive). Migrations have been applied to the real Aurora instance, and
the full path has been exercised end to end against the live deployment: a
real Cognito user with `custom:contractor_id` set, a real ID token,
`GET /officers`, `GET /contractors/me`, and `POST /officers` all against
`https://mau5n5d9u0.execute-api.eu-west-2.amazonaws.com` — not just a local
dev server.

Two real bugs only surfaced at this point and are now fixed: Aurora
16.4 isn't offered in this account/region (now 16.13), and marking
`@prisma/client` as an esbuild external without also copying it into the
bundle meant it was simply missing from the deployed Lambda — see
`lib/prisma-bundling.ts` and `prisma/schema.prisma`'s `binaryTargets`.

`VetroFrontendStack` is also deployed for real, without a custom domain
(`vetro.co.uk` turned out to be already registered elsewhere; the plan is
to point `vetro.com` at it once that's in hand) — CloudFront serves
`app/dist` directly at its own `*.cloudfront.net` domain. `VetroDomainStack`
remains unexercised against a real account for the same reason — `cdk
synth` succeeds with a placeholder `hostedZoneId` (`fromHostedZoneAttributes`,
no AWS call needed), but there's no real hosted zone to deploy it against
yet. Without a custom domain, subdomain-based tenant routing
(`app/src/lib/tenant.ts`) has nothing to read — the deployed frontend only
resolves a tenant via `VITE_DEV_TENANT_SLUG` baked in at build time, so it's
effectively single-tenant until `vetro.com` exists.

The onboarding/vetting-portal role model (`custom:role`, `custom:officer_id`,
`PlatformAdmins` group — see `backend/README.md`'s "Onboarding & roles") is
deployed too: `VetroAuthStack`'s Cognito changes and `VetroApiStack`'s
updated Lambda + IAM permissions for `AdminCreateUser` went out as pure
schema/permission additions (verified via `cdk diff` before deploying), and
the `VettingSubmission` migration was applied via the same `VetroMigrateStack`
Lambda used for earlier migrations.

## Cost shape

Single NAT gateway, Aurora Serverless v2 scaling down to 0.5 ACU, and
Lambda-per-request billing — this is sized for a pilot, not steady
production load. Revisit NAT redundancy and Aurora min capacity once
there's real traffic to size against.
