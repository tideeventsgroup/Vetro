import { CfnOutput, Duration, Stack, StackProps } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as rds from "aws-cdk-lib/aws-rds";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import * as path from "path";

export interface MigrateStackProps extends StackProps {
  vpc: ec2.Vpc;
  proxy: rds.DatabaseProxy;
  dbSecret: secretsmanager.ISecret;
  /** Reused rather than a new one — it already has ingress to the DB security group. */
  apiLambdaSecurityGroup: ec2.SecurityGroup;
}

/**
 * A one-off ops tool, not part of the request path: invoke by hand via
 * `aws lambda invoke` after a schema change, the same way you'd run
 * `prisma migrate deploy` if this database were reachable directly. It
 * isn't — Aurora sits in an isolated private subnet with no route in from
 * outside the VPC — so this runs the migration from inside it instead.
 * See backend/src/jobs/migrate.ts for why it uses `pg` rather than the
 * Prisma CLI's own migrate command.
 */
export class MigrateStack extends Stack {
  constructor(scope: Construct, id: string, props: MigrateStackProps) {
    super(scope, id, props);

    const backendRoot = path.join(__dirname, "../../backend");

    const migrateFn = new NodejsFunction(this, "MigrateFunction", {
      entry: path.join(backendRoot, "src/jobs/migrate.ts"),
      projectRoot: backendRoot,
      depsLockFilePath: path.join(backendRoot, "package-lock.json"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 512,
      timeout: Duration.minutes(5),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.apiLambdaSecurityGroup],
      environment: {
        DB_PROXY_ENDPOINT: props.proxy.endpoint,
        DB_SECRET_ARN: props.dbSecret.secretArn,
        DB_NAME: "vetro",
      },
      bundling: {
        // pg's optional native binding, guarded by a try/catch require in
        // pg's own source — not installed, and esbuild can't resolve it
        // without being told to leave it alone.
        externalModules: ["pg-native"],
        commandHooks: {
          beforeBundling: () => [],
          beforeInstall: () => [],
          afterBundling: (inputDir: string, outputDir: string) => [
            `cp -r ${inputDir}/prisma/migrations ${outputDir}/prisma-migrations`,
          ],
        },
      },
    });

    props.dbSecret.grantRead(migrateFn);

    new CfnOutput(this, "MigrateFunctionName", { value: migrateFn.functionName });
  }
}
