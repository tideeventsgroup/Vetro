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

/** Thrown by createCognitoUser when the email is already someone's Cognito username — callers turn this into a 409, not a 500. */
export class CognitoUserExistsError extends Error {
  constructor(email: string) {
    super(`An account already exists for ${email}`);
    this.name = "CognitoUserExistsError";
  }
}

const PASSWORD_CHARS = {
  lower: "abcdefghijkmnpqrstuvwxyz",
  upper: "ABCDEFGHJKLMNPQRSTUVWXYZ",
  digit: "23456789",
  symbol: "!@#$%^&*",
};

// Matches the pool's password policy (infra/lib/auth-stack.ts: min 12,
// upper/lower/digit/symbol required) — generated ourselves rather than left
// to Cognito so we can hand it back to the inviting admin directly, not only
// via email.
function generateTemporaryPassword(): string {
  const all = Object.values(PASSWORD_CHARS).join("");
  const required = Object.values(PASSWORD_CHARS).map((set) => set[Math.floor(Math.random() * set.length)]);
  const rest = Array.from({ length: 8 }, () => all[Math.floor(Math.random() * all.length)]);
  return [...required, ...rest].sort(() => Math.random() - 0.5).join("");
}

/**
 * Creates the Cognito account behind an invite. Username is the email.
 * Cognito's built-in email service also attempts to send the temporary
 * password (DesiredDeliveryMediums below) — fine at onboarding volumes, but
 * it's capped at 50 emails/day for the whole pool with no way to raise that
 * short of moving to SES, so it's not the only way this password reaches
 * the invitee: the caller gets it back in the response too, to hand over
 * directly if email doesn't arrive. The caller sets whichever custom:*
 * attributes decide what the account can do once it logs in
 * (contractor_id — the org/tenant assignment, role) — this module has no
 * opinion on that.
 *
 * clientMetadata (see buildInviteClientMetadata) is how the org name and a
 * sign-in link reach the CustomMessage Lambda trigger
 * (infra/lib/auth-stack.ts, backend/src/triggers/customMessage.ts) that
 * fills in the invite email's text — this module just passes it through.
 */
export async function createCognitoUser(params: {
  email: string;
  attributes: Record<string, string>;
  clientMetadata?: Record<string, string>;
}): Promise<{ temporaryPassword: string }> {
  const temporaryPassword = generateTemporaryPassword();
  try {
    await getClient().send(
      new AdminCreateUserCommand({
        UserPoolId: requireUserPoolId(),
        Username: params.email,
        UserAttributes: [
          { Name: "email", Value: params.email },
          { Name: "email_verified", Value: "true" },
          ...Object.entries(params.attributes).map(([Name, Value]) => ({ Name, Value })),
        ],
        TemporaryPassword: temporaryPassword,
        DesiredDeliveryMediums: ["EMAIL"],
        ClientMetadata: params.clientMetadata,
      }),
    );
  } catch (err) {
    if (err instanceof Error && err.name === "UsernameExistsException") {
      throw new CognitoUserExistsError(params.email);
    }
    throw err;
  }
  return { temporaryPassword };
}

/**
 * The org name + sign-in link to hand to createCognitoUser's clientMetadata.
 * APP_LOGIN_URL_TEMPLATE (set in infra/lib/api-stack.ts from either the
 * custom domain or the CloudFront fallback — see bin/vetro.ts) has a
 * `{slug}` placeholder for the tenant; omitted entirely if that env var
 * isn't set; customMessage.ts already handles orgName/loginUrl being absent.
 */
export function buildInviteClientMetadata(organisation: { name: string; slug: string }): Record<string, string> {
  const metadata: Record<string, string> = { orgName: organisation.name };
  const template = process.env.APP_LOGIN_URL_TEMPLATE;
  if (template) metadata.loginUrl = template.replace("{slug}", organisation.slug);
  return metadata;
}

export async function addUserToGroup(email: string, groupName: string): Promise<void> {
  await getClient().send(
    new AdminAddUserToGroupCommand({ UserPoolId: requireUserPoolId(), Username: email, GroupName: groupName }),
  );
}

/**
 * Grants an already-existing Cognito account its tenant/role — the step
 * that turns a self-signed-up account (see routes/signup.ts) into an
 * ADMIN of the organisation it just created. Uses the IAM-gated Admin API,
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
 * Every ADMIN and REVIEWER account for a tenant — callers filter by role as
 * needed. Cognito's ListUsers `Filter` only supports a fixed set of
 * standard attributes (email, username, etc.) — custom attributes like
 * custom:contractor_id aren't filterable server-side at all (an
 * InvalidParameterException, not an empty result), so this fetches every
 * user in the pool (paginated) and filters client-side instead. Fine at the
 * account volumes a per-org team list implies; revisit if the pool ever
 * grows large enough for that to matter.
 */
export async function listUsersByOrganisation(organisationId: string): Promise<CognitoUserSummary[]> {
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
      if (attrs["custom:contractor_id"] === organisationId) {
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
