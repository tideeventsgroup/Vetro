import { Hono } from "hono";
import { getDb } from "../db/client.js";
import { recordAudit } from "../lib/audit.js";
import type { AppEnv } from "../lib/hono-env.js";

export const client = new Hono<AppEnv>();

// The client-facing side of scheduling — a site's own contact, scoped
// entirely by custom:site_id (see requireClientSelf in lib/auth.ts), never
// by contractorId or an :id param. They see and confirm shifts at their own
// site; they never see the contractor's roster, other sites, or compliance
// data.
client.get("/client/site", async (c) => {
  const db = await getDb();
  const site = await db.site.findUnique({ where: { id: c.get("siteId")! } });
  if (!site) return c.json({ error: "Site not found" }, 404);
  return c.json(site);
});

client.get("/client/shifts", async (c) => {
  const db = await getDb();
  const rows = await db.shift.findMany({
    where: { siteId: c.get("siteId") },
    include: { officer: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { startTime: "desc" },
    take: 100,
  });
  return c.json(rows);
});

// What actually happened, from the one party who was there to see it —
// completed, missed, or late, with notes for either of the latter.
client.patch("/client/shifts/:id/confirm", async (c) => {
  const db = await getDb();
  const id = c.req.param("id");
  const existing = await db.shift.findUnique({ where: { id } });
  if (!existing || existing.siteId !== c.get("siteId")) {
    return c.json({ error: "Shift not found" }, 404);
  }

  const body = await c.req.json<{
    status: "COMPLETED" | "MISSED" | "LATE";
    incidentNotes?: string;
  }>();
  if (!["COMPLETED", "MISSED", "LATE"].includes(body.status)) {
    return c.json({ error: "status must be COMPLETED, MISSED or LATE" }, 400);
  }

  const updated = await db.shift.update({
    where: { id },
    data: { status: body.status, clientConfirmedAt: new Date(), incidentNotes: body.incidentNotes },
  });

  await recordAudit({
    contractorId: existing.contractorId,
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "shift.client_confirmed",
    entityType: "Shift",
    entityId: id,
    metadata: { status: body.status },
  });

  return c.json(updated);
});
