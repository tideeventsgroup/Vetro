import { CfnOutput, Duration, Stack, StackProps } from "aws-cdk-lib";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as apigwv2integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as rds from "aws-cdk-lib/aws-rds";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import * as path from "path";

export interface ApiStackProps extends StackProps {
  vpc: ec2.Vpc;
  proxy: rds.DatabaseProxy;
  dbSecret: secretsmanager.ISecret;
  apiLambdaSecurityGroup: ec2.SecurityGroup;
  documentsBucket: s3.Bucket;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  /** Both required together to enable api.{domainName} — omit to leave the plain API Gateway URL as-is. */
  domainName?: string;
  hostedZoneId?: string;
}

export class ApiStack extends Stack {
  public readonly apiUrl: string;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const environment = {
      DB_PROXY_ENDPOINT: props.proxy.endpoint,
      DB_SECRET_ARN: props.dbSecret.secretArn,
      DB_NAME: "vetro",
      COGNITO_USER_POOL_ID: props.userPool.userPoolId,
      COGNITO_CLIENT_ID: props.userPoolClient.userPoolClientId,
      DOCUMENTS_BUCKET: props.documentsBucket.bucketName,
    };

    // Bundling note: @prisma/client ships a native query-engine binary that
    // esbuild can't bundle. Keep it external and deploy the generated
    // client (`prisma generate`) as part of the build step, or move to a
    // Lambda layer, before this stack is actually deployed.
    const bundling = {
      externalModules: ["@prisma/client", ".prisma/client"],
    };

    const backendRoot = path.join(__dirname, "../../backend");

    const apiFn = new NodejsFunction(this, "ApiFunction", {
      entry: path.join(backendRoot, "src/lambda.ts"),
      projectRoot: backendRoot,
      depsLockFilePath: path.join(backendRoot, "package-lock.json"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 512,
      timeout: Duration.seconds(15),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.apiLambdaSecurityGroup],
      environment,
      bundling,
    });

    // Native DB-user auth via the secret (fetched at runtime in
    // backend/src/db/client.ts), not IAM auth — so read access to the
    // secret is what the function needs, not rds-db:connect.
    props.dbSecret.grantRead(apiFn);
    props.documentsBucket.grantReadWrite(apiFn);

    const httpApi = new apigwv2.HttpApi(this, "VetroHttpApi", {
      apiName: "vetro-api",
      corsPreflight: {
        allowHeaders: ["Authorization", "Content-Type", "X-Vetro-Tenant"],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.PATCH,
          apigwv2.CorsHttpMethod.DELETE,
        ],
        // Tighten to the real marketing/app origin(s) once known.
        allowOrigins: ["*"],
      },
    });

    httpApi.addRoutes({
      path: "/{proxy+}",
      methods: [apigwv2.HttpMethod.ANY],
      integration: new apigwv2integrations.HttpLambdaIntegration("ApiIntegration", apiFn),
    });

    this.apiUrl = httpApi.apiEndpoint;
    new CfnOutput(this, "ApiUrl", { value: httpApi.apiEndpoint });

    if (props.domainName && props.hostedZoneId) {
      // Regional, not the CloudFront wildcard cert from DomainStack — API
      // Gateway custom domains need a cert in the API's own region.
      const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, "HostedZone", {
        hostedZoneId: props.hostedZoneId,
        zoneName: props.domainName,
      });

      const apiDomainName = `api.${props.domainName}`;
      const certificate = new acm.Certificate(this, "ApiCertificate", {
        domainName: apiDomainName,
        validation: acm.CertificateValidation.fromDns(hostedZone),
      });

      const domain = new apigwv2.DomainName(this, "ApiDomainName", {
        domainName: apiDomainName,
        certificate,
      });

      new apigwv2.ApiMapping(this, "ApiMapping", { api: httpApi, domainName: domain });

      new route53.ARecord(this, "ApiAliasRecord", {
        zone: hostedZone,
        recordName: apiDomainName,
        target: route53.RecordTarget.fromAlias(new targets.ApiGatewayv2DomainProperties(domain.regionalDomainName, domain.regionalHostedZoneId)),
      });

      new CfnOutput(this, "ApiCustomDomainUrl", { value: `https://${apiDomainName}` });
    }
  }
}
