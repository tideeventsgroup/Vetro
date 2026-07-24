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
  /** All three required together for the *.{domainName} wildcard; omit all three to deploy on the plain CloudFront domain instead. */
  domainName?: string;
  hostedZoneId?: string;
  /** From DomainStack, which lives in us-east-1 regardless of this stack's region. */
  certificate?: acm.ICertificate;
}

/**
 * One S3 bucket, one CloudFront distribution, one build of app/dist — every
 * tenant subdomain serves the identical bundle. There's no per-tenant
 * infrastructure at all: the app reads its own subdomain at runtime
 * (app/src/lib/tenant.ts) and the API enforces isolation per-request (see
 * backend/README.md). That's what makes "multi-tenant" here an application
 * concern, not an infrastructure one.
 *
 * Without a domain configured, this still deploys — just on the default
 * *.cloudfront.net domain, which has no subdomain to read a tenant from.
 * app/src/lib/tenant.ts falls back to VITE_DEV_TENANT_SLUG in that case,
 * so it's a real but single-tenant preview until a domain exists.
 */
export class FrontendStack extends Stack {
  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    const domainConfigured = Boolean(props.domainName && props.hostedZoneId && props.certificate);

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
      ...(domainConfigured
        ? { domainNames: [`*.${props.domainName}`], certificate: props.certificate }
        : {}),
    });

    if (domainConfigured) {
      const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, "HostedZone", {
        hostedZoneId: props.hostedZoneId!,
        zoneName: props.domainName!,
      });

      new route53.ARecord(this, "WildcardAliasRecord", {
        zone: hostedZone,
        recordName: `*.${props.domainName}`,
        target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
      });
    }

    // Split in two so the two halves get opposite cache lifetimes: hashed
    // /assets/* files are safe to cache forever (a content change always
    // means a new filename), but the app shell — index.html, sw.js,
    // registerSW.js, manifest.webmanifest — has to be revalidated on every
    // request. Without this, a browser (or the PWA's own service worker,
    // which precaches index.html per workbox's globPatterns above) can go
    // on serving a deploy from hours or days ago indefinitely, since a
    // single-page app never re-fetches its shell after the first load —
    // exactly the failure mode that made an already-shipped bug fix look
    // like it hadn't landed.
    new s3deploy.BucketDeployment(this, "DeploySiteAssets", {
      sources: [s3deploy.Source.asset(path.join(__dirname, "../../app/dist/assets"))],
      destinationBucket: siteBucket,
      destinationKeyPrefix: "assets",
      cacheControl: [s3deploy.CacheControl.fromString("public, max-age=31536000, immutable")],
    });

    new s3deploy.BucketDeployment(this, "DeploySiteShell", {
      sources: [s3deploy.Source.asset(path.join(__dirname, "../../app/dist"), { exclude: ["assets/**"] })],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ["/*"],
      cacheControl: [s3deploy.CacheControl.fromString("no-cache")],
    });

    new CfnOutput(this, "DistributionDomainName", { value: distribution.distributionDomainName });
  }
}
