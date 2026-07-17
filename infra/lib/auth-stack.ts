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
      accessTokenValidity: undefined,
    });
  }
}
