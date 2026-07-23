import { Hono } from "hono";
import { getDb } from "../db/client.js";
import { recordAudit } from "../lib/audit.js";
import { updateUserAttributes } from "../lib/cognito.js";
import type { AppEnv } from "../lib/hono-env.js";

export const signup = new Hono<AppEnv>();

// Self-serve: a freshly-signed-up Cognito account (no org yet) creates its
// own organisation and becomes its ADMIN — the alternative to a platform
// admin creating the org by hand (routes/admin.ts). Gated only on already
// having an organisationId: an account only ever gets to do this once, so it
// can't be replayed to hijack or duplicate an existing membership.
signup.post("/signup/organisation", async (c) => {
  if (c.get("organisationId")) {
    return c.json({ error: "This account already belongs to an organisation" }, 409);
  }
  const actorEmail = c.get("actorEmail");
  const cognitoUsername = c.get("cognitoUsername");
  if (!actorEmail || !cognitoUsername) return c.json({ error: "Unauthenticated" }, 401);

  const body = await c.req.json<{ name: string; slug: string }>();
  if (!body.name?.trim() || !body.slug?.trim()) {
    return c.json({ error: "name and slug are required" }, 400);
  }

  const db = await getDb();
  const existing = await db.organisation.findUnique({ where: { slug: body.slug } });
  if (existing) return c.json({ error: "That organisation URL is already taken" }, 409);

  const organisation = await db.organisation.create({ data: { name: body.name, slug: body.slug } });

  try {
    // cognitoUsername, not actorEmail — a self-serve account's real Cognito
    // username is an auto-generated id, not its email (see hono-env.ts).
    await updateUserAttributes(cognitoUsername, {
      "custom:contractor_id": organisation.id,
      "custom:role": "ADMIN",
    });
  } catch (err) {
    // Don't leave an org behind that its own creator can never administer.
    await db.organisation.delete({ where: { id: organisation.id } });
    throw err;
  }

  await recordAudit({
    organisationId: organisation.id,
    actorEmail,
    action: "organisation.self_signup",
    entityType: "Organisation",
    entityId: organisation.id,
  });

  return c.json(organisation, 201);
});
