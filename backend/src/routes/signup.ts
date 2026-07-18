import { Hono } from "hono";
import { getDb } from "../db/client.js";
import { recordAudit } from "../lib/audit.js";
import { updateUserAttributes } from "../lib/cognito.js";
import type { AppEnv } from "../lib/hono-env.js";

export const signup = new Hono<AppEnv>();

// Self-serve: a freshly-signed-up Cognito account (no org yet) creates its
// own organization and becomes its ADMIN — the alternative to a platform
// admin creating the org by hand (routes/admin.ts). Gated only on already
// having a contractorId: an account only ever gets to do this once, so it
// can't be replayed to hijack or duplicate an existing membership.
signup.post("/signup/organization", async (c) => {
  if (c.get("contractorId")) {
    return c.json({ error: "This account already belongs to an organization" }, 409);
  }
  const actorEmail = c.get("actorEmail");
  if (!actorEmail) return c.json({ error: "Unauthenticated" }, 401);

  const body = await c.req.json<{ name: string; slug: string }>();
  if (!body.name?.trim() || !body.slug?.trim()) {
    return c.json({ error: "name and slug are required" }, 400);
  }

  const db = await getDb();
  const existing = await db.contractor.findUnique({ where: { slug: body.slug } });
  if (existing) return c.json({ error: "That organisation URL is already taken" }, 409);

  const contractor = await db.contractor.create({ data: { name: body.name, slug: body.slug } });

  try {
    await updateUserAttributes(actorEmail, {
      "custom:contractor_id": contractor.id,
      "custom:role": "ADMIN",
    });
  } catch (err) {
    // Don't leave an org behind that its own creator can never administer.
    await db.contractor.delete({ where: { id: contractor.id } });
    throw err;
  }

  await recordAudit({
    actorEmail,
    action: "organization.self_signup",
    entityType: "Contractor",
    entityId: contractor.id,
  });

  return c.json(contractor, 201);
});
