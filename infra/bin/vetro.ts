#!/usr/bin/env node
import { App } from "aws-cdk-lib";
import { NetworkStack } from "../lib/network-stack";
import { DataStack } from "../lib/data-stack";
import { AuthStack } from "../lib/auth-stack";
import { ApiStack } from "../lib/api-stack";
import { ScheduleStack } from "../lib/schedule-stack";

const app = new App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? "eu-west-2",
};

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
});

new ScheduleStack(app, "VetroScheduleStack", {
  env,
  vpc: network.vpc,
  proxy: data.proxy,
  dbSecret: data.dbSecret,
  scheduleLambdaSecurityGroup: data.scheduleLambdaSecurityGroup,
});
