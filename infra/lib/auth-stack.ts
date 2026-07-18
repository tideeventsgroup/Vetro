import { RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import * as path from "path";

export class AuthStack extends Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const backendRoot = path.join(__dirname, "../../backend");

    // Fills in the org name and a sign-in link on the AdminCreateUser invite
    // email (see backend/src/triggers/customMessage.ts) — everything it
    // needs arrives via ClientMetadata on the AdminCreateUser call, so this
    // needs no VPC/DB access of its own.
    const customMessageFn = new NodejsFunction(this, "CustomMessageFunction", {
      entry: path.join(backendRoot, "src/triggers/customMessage.ts"),
      projectRoot: backendRoot,
      depsLockFilePath: path.join(backendRoot, "package-lock.json"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
    });

    // One pool for contractor admins / office managers — the people
    // "doing the checking", per the brand guidelines' voice principles.
    // Not for officers themselves; they don't log in to Vetro.
    this.userPool = new cognito.UserPool(this, "VetroUserPool", {
      // Self-serve: anyone can create the *account*. What that account can
      // do (custom:contractor_id/role below) is a separate question, never
      // decided by the signup call itself — see the writeAttributes note
      // on the app client and backend/src/routes/signup.ts.
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: false },
      },
      // The tenant assignment, plus who this account is within that tenant.
      // All three are set via AdminCreateUser/AdminUpdateUserAttributes —
      // by the backend, using IAM-privileged Admin* Cognito calls, never by
      // the client (see writeAttributes below and backend/README.md's
      // "Onboarding & roles"). role: "ADMIN" for contractor admins/office
      // managers, "OFFICER" for the self-service portal, "CLIENT" for a
      // site's own contact reviewing/confirming shifts there. officer_id is
      // only set for OFFICER accounts and scopes that login to exactly one
      // Officer record; site_id is the CLIENT equivalent, scoping a login to
      // exactly one Site.
      customAttributes: {
        contractor_id: new cognito.StringAttribute({ mutable: true }),
        role: new cognito.StringAttribute({ mutable: true }),
        officer_id: new cognito.StringAttribute({ mutable: true }),
        site_id: new cognito.StringAttribute({ mutable: true }),
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
      lambdaTriggers: { customMessage: customMessageFn },
    });

    this.userPoolClient = this.userPool.addClient("VetroWebClient", {
      authFlows: { userPassword: true, userSrp: true },
      generateSecret: false,
      // Custom attributes have to be explicitly readable by the client to
      // show up as ID token claims at all — this is what
      // backend/src/lib/auth.ts reads to resolve tenant, role and officer.
      readAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({ email: true })
        .withCustomAttributes("contractor_id", "role", "officer_id", "site_id"),
      // Deliberately email-only. Leaving this unset defaults to every
      // mutable attribute being client-writable — which would mean any
      // signed-in user could call Cognito's own UpdateUserAttributes
      // directly and set their own custom:role=ADMIN or custom:contractor_id
      // to someone else's tenant, bypassing the backend entirely. Those
      // claims are only ever set server-side via Admin* Cognito calls
      // (IAM-gated, not subject to this client's attribute permissions).
      writeAttributes: new cognito.ClientAttributes().withStandardAttributes({ email: true }),
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
