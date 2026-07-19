import { Hono } from "hono";
import { getDb } from "../db/client.js";
import { recordAudit } from "../lib/audit.js";
import type { AppEnv } from "../lib/hono-env.js";

// Admin side of patrol tours: defining a site's checkpoints and viewing the
// resulting scan log. Officers scan from the self-service portal
// (routes/me.ts), scoped to sites they've actually been shifted at.
export const checkpoints = new Hono<AppEnv>();

checkpoints.get("/checkpoints", async (c) => {
  const db = await getDb();
  const siteId = c.req.query("siteId");
  const rows = await db.checkpoint.findMany({
    where: { contractorId: c.get("contractorId"), ...(siteId ? { siteId } : {}) },
    include: { site: true },
    orderBy: { createdAt: "asc" },
  });
  return c.json(rows);
});

checkpoints.post("/checkpoints", async (c) => {
  const db = await getDb();
  const contractorId = c.get("contractorId")!;
  const body = await c.req.json<{
    siteId: string;
    name: string;
    description?: string;
    latitude?: number;
    longitude?: number;
    geofenceRadiusM?: number;
  }>();
  if (!body.siteId || !body.name?.trim()) return c.json({ error: "siteId and name are required" }, 400);

  const site = await db.site.findUnique({ where: { id: body.siteId } });
  if (!site || site.contractorId !== contractorId) return c.json({ error: "Site not found" }, 404);

  const created = await db.checkpoint.create({
    data: {
      contractorId,
      siteId: body.siteId,
      name: body.name.trim(),
      description: body.description,
      latitude: body.latitude,
      longitude: body.longitude,
      geofenceRadiusM: body.geofenceRadiusM,
    },
    include: { site: true },
  });

  await recordAudit({
    contractorId,
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "checkpoint.created",
    entityType: "Checkpoint",
    entityId: created.id,
  });

  return c.json(created, 201);
});

checkpoints.patch("/checkpoints/:id", async (c) => {
  const db = await getDb();
  const id = c.req.param("id");
  const existing = await db.checkpoint.findUnique({ where: { id } });
  if (!existing || existing.contractorId !== c.get("contractorId")) {
    return c.json({ error: "Checkpoint not found" }, 404);
  }

  const body = await c.req.json<
    Partial<{
      name: string;
      description: string;
      latitude: number | null;
      longitude: number | null;
      geofenceRadiusM: number | null;
    }>
  >();
  const updated = await db.checkpoint.update({ where: { id }, data: body, include: { site: true } });
  await recordAudit({
    contractorId: c.get("contractorId"),
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "checkpoint.updated",
    entityType: "Checkpoint",
    entityId: id,
  });
  return c.json(updated);
});

checkpoints.delete("/checkpoints/:id", async (c) => {
  const db = await getDb();
  const id = c.req.param("id");
  const existing = await db.checkpoint.findUnique({ where: { id } });
  if (!existing || existing.contractorId !== c.get("contractorId")) {
    return c.json({ error: "Checkpoint not found" }, 404);
  }

  await db.checkpoint.delete({ where: { id } });
  await recordAudit({
    contractorId: c.get("contractorId"),
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "checkpoint.deleted",
    entityType: "Checkpoint",
    entityId: id,
  });
  return c.body(null, 204);
});

// The tour log — every scan, most recent first, so an admin can see whether
// a round was actually walked (and how long it took) rather than just
// trusting it happened.
checkpoints.get("/patrol-log", async (c) => {
  const db = await getDb();
  const siteId = c.req.query("siteId");
  const from = c.req.query("from");
  const to = c.req.query("to");

  const rows = await db.checkpointScan.findMany({
    where: {
      contractorId: c.get("contractorId"),
      ...(siteId ? { checkpoint: { siteId } } : {}),
      ...(from || to
        ? {
            scannedAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    },
    include: { checkpoint: { include: { site: true } }, officer: true },
    orderBy: { scannedAt: "desc" },
    take: 200,
  });
  return c.json(rows);
});
