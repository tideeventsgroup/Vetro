import { Hono } from "hono";
import { getDb } from "../db/client.js";
import { recordAudit } from "../lib/audit.js";
import { deriveStatus } from "../lib/status.js";
import type { AppEnv } from "../lib/hono-env.js";

export const vetting = new Hono<AppEnv>();

vetting.post("/officers/:officerId/vetting", async (c) => {
  const db = await getDb();
  const officerId = c.req.param("officerId");
  const body = await c.req.json<{
    standard?: string;
    completedDate: string;
    expiryDate?: string;
    notes?: string;
  }>();

  const expiryDate = body.expiryDate ? new Date(body.expiryDate) : null;
  const created = await db.vettingRecord.create({
    data: {
      officerId,
      standard: body.standard ?? "BS7858",
      completedDate: new Date(body.completedDate),
      expiryDate,
      notes: body.notes,
      status: deriveStatus(expiryDate),
    },
  });

  await recordAudit({
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "vetting.created",
    entityType: "VettingRecord",
    entityId: created.id,
  });

  return c.json(created, 201);
});

vetting.patch("/vetting/:id", async (c) => {
  const db = await getDb();
  const id = c.req.param("id");
  const body = await c.req.json<Partial<{ expiryDate: string; notes: string }>>();
  const expiryDate = body.expiryDate ? new Date(body.expiryDate) : undefined;

  const updated = await db.vettingRecord.update({
    where: { id },
    data: {
      ...body,
      expiryDate,
      status: expiryDate ? deriveStatus(expiryDate) : undefined,
    },
  });

  await recordAudit({
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "vetting.updated",
    entityType: "VettingRecord",
    entityId: id,
  });

  return c.json(updated);
});
