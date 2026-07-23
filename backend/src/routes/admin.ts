import { Hono } from "hono";
import { getDb } from "../db/client.js";
import { recordAudit } from "../lib/audit.js";
import { createCognitoUser } from "../lib/cognito.js";
import type { AppEnv } from "../lib/hono-env.js";

export const admin = new Hono<AppEnv>();

// Platform-admin only (see requirePlatformAdmin in lib/auth.ts): stands up a
// brand-new organisation and its first ADMIN account in one step. There's no
// public signup path here — this is the one place an Organisation gets
// created this way, an ops action gated on Cognito PlatformAdmins group
// membership. Everything after this is that org's own admin inviting
// teammates (see routes/invitations.ts).
admin.post("/organisations", async (c) => {
  const body = await c.req.json<{ name: string; slug: string; adminEmail: string }>();
  if (!body.name || !body.slug || !body.adminEmail) {
    return c.json({ error: "name, slug and adminEmail are required" }, 400);
  }

  const db = await getDb();
  const existing = await db.organisation.findUnique({ where: { slug: body.slug } });
  if (existing) return c.json({ error: "An organisation with that slug already exists" }, 409);

  const organisation = await db.organisation.create({ data: { name: body.name, slug: body.slug } });

  try {
    await createCognitoUser({
      email: body.adminEmail,
      attributes: { "custom:contractor_id": organisation.id, "custom:role": "ADMIN" },
    });
  } catch (err) {
    // Don't leave an org behind with no admin who can ever log into it —
    // the slug would also be permanently squatted on a dead record.
    await db.organisation.delete({ where: { id: organisation.id } });
    throw err;
  }

  await recordAudit({
    organisationId: organisation.id,
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "organisation.created",
    entityType: "Organisation",
    entityId: organisation.id,
    metadata: { adminEmail: body.adminEmail },
  });

  return c.json(organisation, 201);
});
