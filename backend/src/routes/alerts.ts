import { Hono } from "hono";
import { getDb } from "../db/client.js";
import { recordAudit } from "../lib/audit.js";
import type { AppEnv } from "../lib/hono-env.js";

// Admin-side view of lone-worker SOS alerts an officer has triggered (see
// routes/me.ts's POST /me/sos). This is a status board, not a source of
// alerts — every row here originates from an officer's own device.
export const alerts = new Hono<AppEnv>();

alerts.get("/alerts", async (c) => {
  const db = await getDb();
  const status = c.req.query("status");
  const rows = await db.alert.findMany({
    where: {
      contractorId: c.get("contractorId"),
      ...(status ? { status: status as "OPEN" | "ACKNOWLEDGED" | "RESOLVED" } : {}),
    },
    include: { officer: true },
    orderBy: { createdAt: "desc" },
  });
  return c.json(rows);
});

alerts.patch("/alerts/:id", async (c) => {
  const db = await getDb();
  const id = c.req.param("id");
  const contractorId = c.get("contractorId")!;
  const existing = await db.alert.findUnique({ where: { id } });
  if (!existing || existing.contractorId !== contractorId) return c.json({ error: "Alert not found" }, 404);

  const body = await c.req.json<{ status?: "ACKNOWLEDGED" | "RESOLVED" }>();
  if (body.status !== "ACKNOWLEDGED" && body.status !== "RESOLVED") {
    return c.json({ error: "status must be ACKNOWLEDGED or RESOLVED" }, 400);
  }

  const actorEmail = c.get("actorEmail") ?? "unknown";
  const updated = await db.alert.update({
    where: { id },
    data: {
      status: body.status,
      ...(body.status === "ACKNOWLEDGED" && !existing.acknowledgedAt
        ? { acknowledgedAt: new Date(), acknowledgedByEmail: actorEmail }
        : {}),
      ...(body.status === "RESOLVED" ? { resolvedAt: new Date() } : {}),
    },
    include: { officer: true },
  });

  await recordAudit({
    contractorId,
    actorEmail,
    action: body.status === "ACKNOWLEDGED" ? "alert.acknowledged" : "alert.resolved",
    entityType: "Alert",
    entityId: id,
  });

  return c.json(updated);
});
