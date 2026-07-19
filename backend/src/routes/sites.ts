import { Hono } from "hono";
import { getDb } from "../db/client.js";
import { recordAudit } from "../lib/audit.js";
import { buildInviteClientMetadata, CognitoUserExistsError, createCognitoUser } from "../lib/cognito.js";
import type { AppEnv } from "../lib/hono-env.js";
import { generateSiteSin } from "../lib/identityCodes.js";

export const sites = new Hono<AppEnv>();

sites.get("/sites", async (c) => {
  const db = await getDb();
  const rows = await db.site.findMany({
    where: { contractorId: c.get("contractorId") },
    orderBy: { name: "asc" },
  });
  return c.json(rows);
});

sites.get("/sites/:id", async (c) => {
  const db = await getDb();
  const site = await db.site.findUnique({
    where: { id: c.req.param("id") },
    include: { shifts: { include: { officer: true }, orderBy: { startTime: "desc" }, take: 50 } },
  });
  if (!site || site.contractorId !== c.get("contractorId")) return c.json({ error: "Site not found" }, 404);
  return c.json(site);
});

sites.post("/sites", async (c) => {
  const db = await getDb();
  const body = await c.req.json<{
    name: string;
    address?: string;
    clientContactName?: string;
    clientContactEmail?: string;
    latitude?: number;
    longitude?: number;
    geofenceRadiusM?: number;
  }>();
  if (!body.name?.trim()) return c.json({ error: "name is required" }, 400);

  const created = await db.site.create({ data: { ...body, contractorId: c.get("contractorId")! } });
  await recordAudit({
    contractorId: c.get("contractorId"),
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "site.created",
    entityType: "Site",
    entityId: created.id,
  });
  return c.json(created, 201);
});

sites.patch("/sites/:id", async (c) => {
  const db = await getDb();
  const id = c.req.param("id");
  const existing = await db.site.findUnique({ where: { id } });
  if (!existing || existing.contractorId !== c.get("contractorId")) {
    return c.json({ error: "Site not found" }, 404);
  }

  const body = await c.req.json<
    Partial<{
      name: string;
      address: string;
      clientContactName: string;
      clientContactEmail: string;
      latitude: number | null;
      longitude: number | null;
      geofenceRadiusM: number | null;
    }>
  >();
  // Explicit allowlist, not `data: body` — c.req.json<T>() only types the
  // shape, it doesn't strip extra keys, so passing the raw body through
  // would let a request that adds contractorId reassign this site to a
  // tenant the caller was never checked against.
  const data = {
    ...(body.name !== undefined && { name: body.name }),
    ...(body.address !== undefined && { address: body.address }),
    ...(body.clientContactName !== undefined && { clientContactName: body.clientContactName }),
    ...(body.clientContactEmail !== undefined && { clientContactEmail: body.clientContactEmail }),
    ...(body.latitude !== undefined && { latitude: body.latitude }),
    ...(body.longitude !== undefined && { longitude: body.longitude }),
    ...(body.geofenceRadiusM !== undefined && { geofenceRadiusM: body.geofenceRadiusM }),
  };
  const updated = await db.site.update({ where: { id }, data });
  await recordAudit({
    contractorId: c.get("contractorId"),
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "site.updated",
    entityType: "Site",
    entityId: id,
  });
  return c.json(updated);
});

sites.delete("/sites/:id", async (c) => {
  const db = await getDb();
  const id = c.req.param("id");
  const existing = await db.site.findUnique({ where: { id } });
  if (!existing || existing.contractorId !== c.get("contractorId")) {
    return c.json({ error: "Site not found" }, 404);
  }

  await db.site.delete({ where: { id } });
  await recordAudit({
    contractorId: c.get("contractorId"),
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "site.deleted",
    entityType: "Site",
    entityId: id,
  });
  return c.body(null, 204);
});

// (Re)issues this site's kiosk SIN — typed into a shared site device
// alongside an officer's PIN (routes/kiosk.ts) so book-on/off works without
// anyone signing into their own Cognito login.
sites.post("/sites/:id/sin", async (c) => {
  const db = await getDb();
  const id = c.req.param("id");
  const contractorId = c.get("contractorId")!;
  const existing = await db.site.findUnique({ where: { id } });
  if (!existing || existing.contractorId !== contractorId) {
    return c.json({ error: "Site not found" }, 404);
  }

  const sin = await generateSiteSin(db);
  const updated = await db.site.update({ where: { id }, data: { sin } });

  await recordAudit({
    contractorId,
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "site.sin_regenerated",
    entityType: "Site",
    entityId: id,
  });

  return c.json({ sin: updated.sin });
});

// Gives a site's own client contact a login to review/confirm shifts there
// (see routes/client.ts) — scoped to exactly this one Site via
// custom:site_id, the same pattern as an officer's self-service invite.
sites.post("/sites/:id/invite-client", async (c) => {
  const db = await getDb();
  const id = c.req.param("id");
  const site = await db.site.findUnique({ where: { id } });
  if (!site || site.contractorId !== c.get("contractorId")) {
    return c.json({ error: "Site not found" }, 404);
  }

  const body = await c.req.json<{ email?: string }>().catch(() => ({}) as { email?: string });
  const email = body.email ?? site.clientContactEmail;
  if (!email) {
    return c.json({ error: "Site has no client contact email on file — provide one to invite" }, 400);
  }
  if (email !== site.clientContactEmail) {
    await db.site.update({ where: { id }, data: { clientContactEmail: email } });
  }

  const contractor = await db.contractor.findUniqueOrThrow({ where: { id: site.contractorId } });

  let temporaryPassword: string;
  try {
    ({ temporaryPassword } = await createCognitoUser({
      email,
      attributes: {
        "custom:contractor_id": site.contractorId,
        "custom:role": "CLIENT",
        "custom:site_id": site.id,
      },
      clientMetadata: buildInviteClientMetadata(contractor),
    }));
  } catch (err) {
    if (err instanceof CognitoUserExistsError) return c.json({ error: err.message }, 409);
    throw err;
  }

  await recordAudit({
    contractorId: c.get("contractorId"),
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "site.client_invited",
    entityType: "Site",
    entityId: id,
  });

  return c.json({ status: "invited", email, temporaryPassword }, 201);
});
