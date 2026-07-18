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
| `VetroDomainStack` | *(opt-in, us-east-1)* Wildcard ACM cert for `*.{domainName}` |
| `VetroFrontendStack` | *(opt-in, us-east-1)* S3 + CloudFront serving `app/dist`, aliased to `*.{domainName}` |

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

`cdk synth` succeeds for every stack, including `VetroDomainStack` and
`VetroFrontendStack` with a placeholder `hostedZoneId` (that's what
`fromHostedZoneAttributes` over `fromLookup` buys — no real AWS account
needed to validate the CDK code is well-formed). None of it has been
deployed against a real AWS account or a real hosted zone — that would need
an actual `vetro.co.uk` zone and an account to bootstrap into, neither of
which exist in this environment.

## Cost shape

Single NAT gateway, Aurora Serverless v2 scaling down to 0.5 ACU, and
Lambda-per-request billing — this is sized for a pilot, not steady
production load. Revisit NAT redundancy and Aurora min capacity once
there's real traffic to size against.
