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
      // The tenant assignment, plus who this account is within that tenant.
      // All three are set via AdminCreateUser/AdminUpdateUserAttributes when
      // an account is provisioned — there's no self-serve flow that lets a
      // user set any of these (see backend/README.md's "Multi-tenancy").
      // role: "ADMIN" for contractor admins/office managers, "OFFICER" for
      // the self-service portal. officer_id is only set for OFFICER accounts
      // and scopes that login to exactly one Officer record.
      customAttributes: {
        contractor_id: new cognito.StringAttribute({ mutable: true }),
        role: new cognito.StringAttribute({ mutable: true }),
        officer_id: new cognito.StringAttribute({ mutable: true }),
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
      // Custom attributes have to be explicitly readable by the client to
      // show up as ID token claims at all — this is what
      // backend/src/lib/auth.ts reads to resolve tenant, role and officer.
      readAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({ email: true })
        .withCustomAttributes("contractor_id", "role", "officer_id"),
    });

    // Platform operators who can create new organizations (contractors) —
    // distinct from a contractor's own ADMIN accounts, which can only manage
    // their own tenant. Membership is granted by hand (AdminAddUserToGroup),
    // not through any API route.
    new cognito.CfnUserPoolGroup(this, "PlatformAdminsGroup", {
      userPoolId: this.userPool.userPoolId,
      groupName: "PlatformAdmins",
      description: "Can create new organizations (contractors) across all tenants.",
    });
  }
}
