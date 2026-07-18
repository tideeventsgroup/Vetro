import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminGetUserCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
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

/**
 * Grants an already-existing Cognito account its tenant/role — the step
 * that turns a self-signed-up account (see routes/signup.ts) into an
 * ADMIN of the organization it just created. Uses the IAM-gated Admin API,
 * not the client-facing UpdateUserAttributes the app client is deliberately
 * denied write access to (see infra/lib/auth-stack.ts).
 *
 * Takes the real Cognito username, not an email — for accounts created via
 * public self-serve sign-up, the username is an auto-generated id, and
 * looking such an account up by its email attribute right after signup can
 * transiently 404 before Cognito's alias index catches up.
 */
export async function updateUserAttributes(username: string, attributes: Record<string, string>): Promise<void> {
  await getClient().send(
    new AdminUpdateUserAttributesCommand({
      UserPoolId: requireUserPoolId(),
      Username: username,
      UserAttributes: Object.entries(attributes).map(([Name, Value]) => ({ Name, Value })),
    }),
  );
}

export interface CognitoUserSummary {
  username: string;
  email: string;
  status: string;
  role?: string;
}

/**
 * ADMIN teammates *and* OFFICER self-service accounts for a tenant —
 * callers filter by role as needed. Cognito's ListUsers `Filter` only
 * supports a fixed set of standard attributes (email, username, etc.) —
 * custom attributes like custom:contractor_id aren't filterable server-side
 * at all (an InvalidParameterException, not an empty result), so this
 * fetches every user in the pool (paginated) and filters client-side
 * instead. Fine at the account volumes a per-org team list implies;
 * revisit if the pool ever grows large enough for that to matter.
 */
export async function listUsersByContractor(contractorId: string): Promise<CognitoUserSummary[]> {
  const client = getClient();
  const userPoolId = requireUserPoolId();
  const matches: CognitoUserSummary[] = [];
  let paginationToken: string | undefined;

  do {
    const result = await client.send(
      new ListUsersCommand({ UserPoolId: userPoolId, PaginationToken: paginationToken }),
    );
    for (const user of result.Users ?? []) {
      const attrs = Object.fromEntries((user.Attributes ?? []).map((a) => [a.Name, a.Value]));
      if (attrs["custom:contractor_id"] === contractorId) {
        matches.push({
          username: user.Username ?? "",
          email: attrs.email ?? "",
          status: user.UserStatus ?? "",
          role: attrs["custom:role"],
        });
      }
    }
    paginationToken = result.PaginationToken;
  } while (paginationToken);

  return matches;
}

/** Reads a specific account's attributes — used to verify a username actually belongs to the caller's tenant before acting on it (e.g. removal), rather than trusting a client-supplied username directly. */
export async function getUserAttributes(username: string): Promise<Record<string, string>> {
  const result = await getClient().send(
    new AdminGetUserCommand({ UserPoolId: requireUserPoolId(), Username: username }),
  );
  return Object.fromEntries((result.UserAttributes ?? []).map((a) => [a.Name ?? "", a.Value ?? ""]));
}

export async function deleteUser(username: string): Promise<void> {
  await getClient().send(new AdminDeleteUserCommand({ UserPoolId: requireUserPoolId(), Username: username }));
}
