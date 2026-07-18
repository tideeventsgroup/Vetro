import { Hono } from "hono";
import { getDb } from "../db/client.js";
import { recordAudit } from "../lib/audit.js";
import { createCognitoUser } from "../lib/cognito.js";
import type { AppEnv } from "../lib/hono-env.js";

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
    Partial<{ name: string; address: string; clientContactName: string; clientContactEmail: string }>
  >();
  const updated = await db.site.update({ where: { id }, data: body });
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

  await createCognitoUser({
    email,
    attributes: {
      "custom:contractor_id": site.contractorId,
      "custom:role": "CLIENT",
      "custom:site_id": site.id,
    },
  });

  await recordAudit({
    contractorId: c.get("contractorId"),
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "site.client_invited",
    entityType: "Site",
    entityId: id,
  });

  return c.json({ status: "invited", email }, 201);
});
