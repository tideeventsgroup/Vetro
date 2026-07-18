import { Hono } from "hono";
import { recordAudit } from "../lib/audit.js";
import { CognitoUserExistsError, createCognitoUser } from "../lib/cognito.js";
import type { AppEnv } from "../lib/hono-env.js";

export const invitations = new Hono<AppEnv>();

// An org's own ADMIN inviting a teammate into the same tenant — distinct
// from the platform-admin org-creation path in routes/admin.ts. Mounted
// under tenantScoped in app.ts, so contractorId is always resolved here.
invitations.post("/invitations", async (c) => {
  const body = await c.req.json<{ email: string }>();
  if (!body.email) return c.json({ error: "email is required" }, 400);

  const contractorId = c.get("contractorId")!;

  let temporaryPassword: string;
  try {
    ({ temporaryPassword } = await createCognitoUser({
      email: body.email,
      attributes: { "custom:contractor_id": contractorId, "custom:role": "ADMIN" },
    }));
  } catch (err) {
    if (err instanceof CognitoUserExistsError) return c.json({ error: err.message }, 409);
    throw err;
  }

  await recordAudit({
    contractorId,
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "teammate.invited",
    entityType: "Contractor",
    entityId: contractorId,
    metadata: { email: body.email },
  });

  return c.json({ status: "invited", email: body.email, temporaryPassword }, 201);
});
