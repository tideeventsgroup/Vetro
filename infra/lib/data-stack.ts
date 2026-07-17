import { Duration, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export interface DataStackProps extends StackProps {
  vpc: ec2.Vpc;
}

export class DataStack extends Stack {
  public readonly cluster: rds.DatabaseCluster;
  public readonly proxy: rds.DatabaseProxy;
  public readonly dbSecret: secretsmanager.ISecret;
  public readonly dbSecurityGroup: ec2.SecurityGroup;
  public readonly documentsBucket: s3.Bucket;
  /** Attach to any Lambda that needs to reach the proxy — granted ingress below. */
  public readonly apiLambdaSecurityGroup: ec2.SecurityGroup;
  public readonly scheduleLambdaSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    this.dbSecurityGroup = new ec2.SecurityGroup(this, "DbSecurityGroup", {
      vpc: props.vpc,
      description: "Vetro Aurora cluster",
      allowAllOutbound: false,
    });

    // Created here, not in the consuming stacks, so the ingress rules below
    // don't create a cross-stack dependency cycle (DataStack -> ApiStack ->
    // DataStack) — every consumer just attaches one of these to its Lambda.
    this.apiLambdaSecurityGroup = new ec2.SecurityGroup(this, "ApiLambdaSecurityGroup", {
      vpc: props.vpc,
      description: "Vetro API Lambda",
    });
    this.scheduleLambdaSecurityGroup = new ec2.SecurityGroup(this, "ScheduleLambdaSecurityGroup", {
      vpc: props.vpc,
      description: "Vetro daily expiry-check Lambda",
    });
    this.dbSecurityGroup.addIngressRule(this.apiLambdaSecurityGroup, ec2.Port.tcp(5432), "API Lambda to RDS Proxy");
    this.dbSecurityGroup.addIngressRule(
      this.scheduleLambdaSecurityGroup,
      ec2.Port.tcp(5432),
      "Expiry job to RDS Proxy"
    );

    // Aurora Serverless v2: scales to near-zero between pilot-customer
    // traffic instead of paying for an always-on instance.
    this.cluster = new rds.DatabaseCluster(this, "VetroCluster", {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_16_4,
      }),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [this.dbSecurityGroup],
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 4,
      writer: rds.ClusterInstance.serverlessV2("Writer"),
      defaultDatabaseName: "vetro",
      credentials: rds.Credentials.fromGeneratedSecret("vetro_admin"),
      removalPolicy: RemovalPolicy.SNAPSHOT,
      storageEncrypted: true,
    });

    this.dbSecret = this.cluster.secret!;

    // Lambda talks to the proxy, not the cluster directly — connections are
    // pooled so bursts of concurrent invocations don't exhaust Postgres
    // connection limits.
    this.proxy = this.cluster.addProxy("VetroProxy", {
      vpc: props.vpc,
      secrets: [this.dbSecret],
      securityGroups: [this.dbSecurityGroup],
      requireTLS: true,
      idleClientTimeout: Duration.minutes(30),
    });

    this.documentsBucket = new s3.Bucket(this, "DocumentsBucket", {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });
  }
}
