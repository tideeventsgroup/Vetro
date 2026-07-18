import { Hono } from "hono";
import { getDb } from "../db/client.js";
import { recordAudit } from "../lib/audit.js";
import { createCognitoUser } from "../lib/cognito.js";
import type { AppEnv } from "../lib/hono-env.js";

export const admin = new Hono<AppEnv>();

// Platform-admin only (see requirePlatformAdmin in lib/auth.ts): stands up a
// brand-new organization and its first ADMIN account in one step. There's no
// public signup — this is the one place a Contractor gets created, and it's
// an ops action gated on Cognito PlatformAdmins group membership. Everything
// after this is that org's own admin inviting teammates/officers (see
// routes/invitations.ts and the officer invite route in routes/officers.ts).
admin.post("/organizations", async (c) => {
  const body = await c.req.json<{ name: string; slug: string; adminEmail: string }>();
  if (!body.name || !body.slug || !body.adminEmail) {
    return c.json({ error: "name, slug and adminEmail are required" }, 400);
  }

  const db = await getDb();
  const existing = await db.contractor.findUnique({ where: { slug: body.slug } });
  if (existing) return c.json({ error: "An organization with that slug already exists" }, 409);

  const contractor = await db.contractor.create({ data: { name: body.name, slug: body.slug } });

  try {
    await createCognitoUser({
      email: body.adminEmail,
      attributes: { "custom:contractor_id": contractor.id, "custom:role": "ADMIN" },
    });
  } catch (err) {
    // Don't leave an org behind with no admin who can ever log into it —
    // the slug would also be permanently squatted on a dead record.
    await db.contractor.delete({ where: { id: contractor.id } });
    throw err;
  }

  await recordAudit({
    contractorId: contractor.id,
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "organization.created",
    entityType: "Contractor",
    entityId: contractor.id,
    metadata: { adminEmail: body.adminEmail },
  });

  return c.json(contractor, 201);
});
