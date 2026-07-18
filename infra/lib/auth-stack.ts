import { RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import { Construct } from "constructs";

export class AuthStack extends Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // One pool for contractor admins / office managers — the people
    // "doing the checking", per the brand guidelines' voice principles.
    // Not for officers themselves; they don't log in to Vetro.
    this.userPool = new cognito.UserPool(this, "VetroUserPool", {
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      standardAttributes: {
        email: { required: true, mutable: false },
      },
      // The tenant assignment. Set via AdminUpdateUserAttributes when a
      // contractor's account is set up — there's no self-serve flow that
      // lets a user set their own (see backend/README.md's "Multi-tenancy").
      customAttributes: {
        contractor_id: new cognito.StringAttribute({ mutable: true }),
      },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    this.userPoolClient = this.userPool.addClient("VetroWebClient", {
      authFlows: { userPassword: true, userSrp: true },
      generateSecret: false,
      // custom:contractor_id has to be explicitly readable by the client to
      // show up as an ID token claim at all — this is what
      // backend/src/lib/auth.ts reads to resolve the tenant.
      readAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({ email: true })
        .withCustomAttributes("contractor_id"),
    });
  }
}
