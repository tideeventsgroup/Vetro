import { CfnOutput, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";
import * as path from "path";

export interface FrontendStackProps extends StackProps {
  domainName: string;
  hostedZoneId: string;
  /** From DomainStack, which lives in us-east-1 regardless of this stack's region. */
  certificate: acm.ICertificate;
}

/**
 * One S3 bucket, one CloudFront distribution, one build of app/dist — every
 * tenant subdomain serves the identical bundle. There's no per-tenant
 * infrastructure at all: the app reads its own subdomain at runtime
 * (app/src/lib/tenant.ts) and the API enforces isolation per-request (see
 * backend/README.md). That's what makes "multi-tenant" here an application
 * concern, not an infrastructure one.
 */
export class FrontendStack extends Stack {
  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, "HostedZone", {
      hostedZoneId: props.hostedZoneId,
      zoneName: props.domainName,
    });

    const siteBucket = new s3.Bucket(this, "SiteBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const distribution = new cloudfront.Distribution(this, "Distribution", {
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      // SPA routing: any path not found in the bucket is still index.html,
      // client-side router takes it from there.
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: "/index.html" },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: "/index.html" },
      ],
      domainNames: [`*.${props.domainName}`],
      certificate: props.certificate,
    });

    new route53.ARecord(this, "WildcardAliasRecord", {
      zone: hostedZone,
      recordName: `*.${props.domainName}`,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
    });

    new s3deploy.BucketDeployment(this, "DeploySite", {
      sources: [s3deploy.Source.asset(path.join(__dirname, "../../app/dist"))],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ["/*"],
    });

    new CfnOutput(this, "DistributionDomainName", { value: distribution.distributionDomainName });
  }
}
