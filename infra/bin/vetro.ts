#!/usr/bin/env node
import { App } from "aws-cdk-lib";
import { NetworkStack } from "../lib/network-stack";
import { DataStack } from "../lib/data-stack";
import { AuthStack } from "../lib/auth-stack";
import { ApiStack } from "../lib/api-stack";
import { ScheduleStack } from "../lib/schedule-stack";
import { DomainStack } from "../lib/domain-stack";
import { FrontendStack } from "../lib/frontend-stack";
import { MigrateStack } from "../lib/migrate-stack";

const app = new App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? "eu-west-2",
};

// Custom domains (*.vetro.co.uk, api.vetro.co.uk) are opt-in: without both
// of these, the app deploys with the plain CloudFront/API Gateway URLs.
// Supply via `-c domainName=vetro.co.uk -c hostedZoneId=Z0123...` (the
// hosted zone must already exist — this app doesn't register or delegate
// the domain, just points records at it).
const domainName: string | undefined = app.node.tryGetContext("domainName");
const hostedZoneId: string | undefined = app.node.tryGetContext("hostedZoneId");
const domainConfigured = Boolean(domainName && hostedZoneId);

// The sign-in link the invite email's CustomMessage trigger puts in for a
// given org (backend/src/triggers/customMessage.ts) — `{slug}` is filled in
// per-invite from the Contractor row. Subdomain routing once the custom
// domain is live; until then, falls back to the known CloudFront default
// domain's path-based tenant routing (see app/src/lib/tenant.ts). Override
// the fallback with `-c appBaseUrl=https://...` if that CloudFront domain
// ever changes before the custom domain is ready.
const appBaseUrl: string | undefined = app.node.tryGetContext("appBaseUrl");
const DEFAULT_APP_BASE_URL = "https://d174513nsstzu9.cloudfront.net";
const loginUrlTemplate = domainConfigured
  ? `https://{slug}.${domainName}/login`
  : `${appBaseUrl ?? DEFAULT_APP_BASE_URL}/{slug}/login`;

const network = new NetworkStack(app, "VetroNetworkStack", { env });
const data = new DataStack(app, "VetroDataStack", { env, vpc: network.vpc });
const auth = new AuthStack(app, "VetroAuthStack", { env });

new ApiStack(app, "VetroApiStack", {
  env,
  vpc: network.vpc,
  proxy: data.proxy,
  dbSecret: data.dbSecret,
  apiLambdaSecurityGroup: data.apiLambdaSecurityGroup,
  documentsBucket: data.documentsBucket,
  userPool: auth.userPool,
  userPoolClient: auth.userPoolClient,
  domainName,
  hostedZoneId,
  loginUrlTemplate,
  groqApiKey: process.env.GROQ_API_KEY,
});

new ScheduleStack(app, "VetroScheduleStack", {
  env,
  vpc: network.vpc,
  proxy: data.proxy,
  dbSecret: data.dbSecret,
  scheduleLambdaSecurityGroup: data.scheduleLambdaSecurityGroup,
});

new MigrateStack(app, "VetroMigrateStack", {
  env,
  vpc: network.vpc,
  proxy: data.proxy,
  dbSecret: data.dbSecret,
  apiLambdaSecurityGroup: data.apiLambdaSecurityGroup,
});

// us-east-1 regardless of the main app region: both a hard CloudFront
// requirement (the cert, when there is one) and just a simplifying choice
// for the rest of FrontendStack, which has no reason to live anywhere else.
const domainEnv = { account: env.account, region: "us-east-1" };

const domain = domainConfigured
  ? new DomainStack(app, "VetroDomainStack", {
      env: domainEnv,
      domainName: domainName!,
      hostedZoneId: hostedZoneId!,
    })
  : undefined;

// Deploys either way — on *.{domainName} once that's configured, or on the
// plain CloudFront domain as a single-tenant preview until then.
new FrontendStack(app, "VetroFrontendStack", {
  env: domainEnv,
  domainName,
  hostedZoneId,
  certificate: domain?.wildcardCertificate,
});
