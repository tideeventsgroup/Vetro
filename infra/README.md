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
| `VetroAuthStack` | Cognito user pool + client for contractor admins |
| `VetroApiStack` | Lambda (bundles `backend/src/lambda.ts`) behind an HTTP API |
| `VetroScheduleStack` | Daily EventBridge rule → Lambda (bundles `backend/src/jobs/checkExpiries.ts`) |

## Before deploying

1. `npm install` in both `infra/` and `backend/`.
2. `cd ../backend && npm run prisma:generate` — the API and schedule Lambdas
   bundle `backend/src/lambda.ts` / `backend/src/jobs/checkExpiries.ts`
   directly (see the `externalModules` note in `lib/api-stack.ts`), so the
   generated Prisma client needs to exist on disk first; esbuild bundling
   doesn't run `prisma generate` for you.
3. `npx cdk bootstrap aws://<account>/<region>` once per account/region.

## Deploy

```bash
npm run diff     # review changes
npm run deploy    # cdk deploy --all
```

## Cost shape

Single NAT gateway, Aurora Serverless v2 scaling down to 0.5 ACU, and
Lambda-per-request billing — this is sized for a pilot, not steady
production load. Revisit NAT redundancy and Aurora min capacity once
there's real traffic to size against.
