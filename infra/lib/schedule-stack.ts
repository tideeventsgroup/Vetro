import { Duration, Stack, StackProps } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as rds from "aws-cdk-lib/aws-rds";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import * as path from "path";

export interface ScheduleStackProps extends StackProps {
  vpc: ec2.Vpc;
  proxy: rds.DatabaseProxy;
  dbSecret: secretsmanager.ISecret;
  scheduleLambdaSecurityGroup: ec2.SecurityGroup;
}

export class ScheduleStack extends Stack {
  constructor(scope: Construct, id: string, props: ScheduleStackProps) {
    super(scope, id, props);

    const backendRoot = path.join(__dirname, "../../backend");

    const checkExpiriesFn = new NodejsFunction(this, "CheckExpiriesFunction", {
      entry: path.join(backendRoot, "src/jobs/checkExpiries.ts"),
      projectRoot: backendRoot,
      depsLockFilePath: path.join(backendRoot, "package-lock.json"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 512,
      timeout: Duration.minutes(5),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.scheduleLambdaSecurityGroup],
      environment: {
        DB_PROXY_ENDPOINT: props.proxy.endpoint,
        DB_SECRET_ARN: props.dbSecret.secretArn,
        DB_NAME: "vetro",
      },
      bundling: {
        externalModules: ["@prisma/client", ".prisma/client"],
      },
    });

    props.dbSecret.grantRead(checkExpiriesFn);

    // "Checked automatically, not chased manually" — once a day, no one
    // has to remember to look.
    new events.Rule(this, "DailyExpiryCheckRule", {
      schedule: events.Schedule.rate(Duration.hours(24)),
      targets: [new targets.LambdaFunction(checkExpiriesFn)],
    });
  }
}
