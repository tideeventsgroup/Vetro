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

if (domainConfigured) {
  // us-east-1 regardless of the main app region: both a hard CloudFront
  // requirement (the cert) and just a simplifying choice (the rest of
  // FrontendStack, which has no reason to live anywhere else).
  const domainEnv = { account: env.account, region: "us-east-1" };

  const domain = new DomainStack(app, "VetroDomainStack", {
    env: domainEnv,
    domainName: domainName!,
    hostedZoneId: hostedZoneId!,
  });

  new FrontendStack(app, "VetroFrontendStack", {
    env: domainEnv,
    domainName: domainName!,
    hostedZoneId: hostedZoneId!,
    certificate: domain.wildcardCertificate,
  });
}
