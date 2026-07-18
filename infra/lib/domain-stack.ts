import { Stack, StackProps } from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as route53 from "aws-cdk-lib/aws-route53";
import { Construct } from "constructs";

export interface DomainStackProps extends StackProps {
  domainName: string;
  hostedZoneId: string;
}

/**
 * The wildcard cert CloudFront needs for every tenant subdomain. Must live
 * in us-east-1 regardless of where the rest of the app is deployed — a
 * CloudFront-specific ACM requirement, not a Vetro one.
 *
 * Uses `fromHostedZoneAttributes` (a plain construct, no synth-time AWS
 * call) rather than `fromLookup` (needs a real account to query) — that's
 * what lets `cdk synth` succeed here with a placeholder hosted zone ID, and
 * why the real ID has to be supplied via context/env when actually
 * deploying (see infra/README.md).
 */
export class DomainStack extends Stack {
  public readonly wildcardCertificate: acm.Certificate;
  public readonly hostedZone: route53.IHostedZone;

  constructor(scope: Construct, id: string, props: DomainStackProps) {
    super(scope, id, props);

    this.hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, "HostedZone", {
      hostedZoneId: props.hostedZoneId,
      zoneName: props.domainName,
    });

    this.wildcardCertificate = new acm.Certificate(this, "WildcardCertificate", {
      domainName: props.domainName,
      subjectAlternativeNames: [`*.${props.domainName}`],
      validation: acm.CertificateValidation.fromDns(this.hostedZone),
    });
  }
}
