import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";

let client: CognitoIdentityProviderClient | undefined;

function getClient(): CognitoIdentityProviderClient {
  if (!client) client = new CognitoIdentityProviderClient({});
  return client;
}

function requireUserPoolId(): string {
  const id = process.env.COGNITO_USER_POOL_ID;
  if (!id) throw new Error("Missing required env var: COGNITO_USER_POOL_ID");
  return id;
}

/**
 * Creates the Cognito account behind an invite. Username is the email, and
 * Cognito emails the temporary password itself (its built-in email service —
 * fine at onboarding volumes, no SES setup required). The caller sets
 * whichever custom:* attributes decide what the account can do once it logs
 * in (contractor_id, role, officer_id) — this module has no opinion on that.
 */
export async function createCognitoUser(params: {
  email: string;
  attributes: Record<string, string>;
}): Promise<void> {
  await getClient().send(
    new AdminCreateUserCommand({
      UserPoolId: requireUserPoolId(),
      Username: params.email,
      UserAttributes: [
        { Name: "email", Value: params.email },
        { Name: "email_verified", Value: "true" },
        ...Object.entries(params.attributes).map(([Name, Value]) => ({ Name, Value })),
      ],
      DesiredDeliveryMediums: ["EMAIL"],
    }),
  );
}

export async function addUserToGroup(email: string, groupName: string): Promise<void> {
  await getClient().send(
    new AdminAddUserToGroupCommand({ UserPoolId: requireUserPoolId(), Username: email, GroupName: groupName }),
  );
}
