import { Hono } from "hono";
import { getDb } from "../db/client.js";
import { recordAudit } from "../lib/audit.js";
import { buildInviteClientMetadata, CognitoUserExistsError, createCognitoUser } from "../lib/cognito.js";
import type { AppEnv } from "../lib/hono-env.js";

export const invitations = new Hono<AppEnv>();

const INVITABLE_ROLES = ["ADMIN", "REVIEWER"] as const;

// An org's own ADMIN inviting a teammate into the same tenant — distinct
// from the platform-admin org-creation path in routes/admin.ts. Mounted
// under tenantAdminPrefixes in app.ts, so organisationId is always resolved
// here. ADMIN gets full access (team/settings/role types included);
// REVIEWER can work the candidates/checks review queue but not manage the
// account itself.
invitations.post("/invitations", async (c) => {
  const body = await c.req.json<{ email: string; role?: string }>();
  if (!body.email) return c.json({ error: "email is required" }, 400);
  const role = body.role ?? "ADMIN";
  if (!INVITABLE_ROLES.includes(role as (typeof INVITABLE_ROLES)[number])) {
    return c.json({ error: `role must be one of: ${INVITABLE_ROLES.join(", ")}` }, 400);
  }

  const organisationId = c.get("organisationId")!;
  const db = await getDb();
  const organisation = await db.organisation.findUniqueOrThrow({ where: { id: organisationId } });

  let temporaryPassword: string;
  try {
    ({ temporaryPassword } = await createCognitoUser({
      email: body.email,
      attributes: { "custom:contractor_id": organisationId, "custom:role": role },
      clientMetadata: buildInviteClientMetadata(organisation),
    }));
  } catch (err) {
    if (err instanceof CognitoUserExistsError) return c.json({ error: err.message }, 409);
    throw err;
  }

  await recordAudit({
    organisationId,
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "teammate.invited",
    entityType: "Organisation",
    entityId: organisationId,
    metadata: { email: body.email, role },
  });

  return c.json({ status: "invited", email: body.email, role, temporaryPassword }, 201);
});
