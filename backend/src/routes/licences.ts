import { Hono } from "hono";
import { getDb } from "../db/client.js";
import { recordAudit } from "../lib/audit.js";
import { deriveStatus } from "../lib/status.js";
import type { AppEnv } from "../lib/hono-env.js";

export const licences = new Hono<AppEnv>();

licences.post("/officers/:officerId/licences", async (c) => {
  const db = await getDb();
  const officerId = c.req.param("officerId");
  const body = await c.req.json<{
    licenceNumber: string;
    sector: string;
    issueDate: string;
    expiryDate: string;
  }>();

  const created = await db.siaLicence.create({
    data: {
      officerId,
      licenceNumber: body.licenceNumber,
      sector: body.sector,
      issueDate: new Date(body.issueDate),
      expiryDate: new Date(body.expiryDate),
      status: deriveStatus(new Date(body.expiryDate)),
      lastCheckedAt: new Date(),
    },
  });

  await recordAudit({
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "licence.created",
    entityType: "SiaLicence",
    entityId: created.id,
  });

  return c.json(created, 201);
});

licences.patch("/licences/:id", async (c) => {
  const db = await getDb();
  const id = c.req.param("id");
  const body = await c.req.json<Partial<{ licenceNumber: string; sector: string; expiryDate: string }>>();

  const updated = await db.siaLicence.update({
    where: { id },
    data: {
      ...body,
      expiryDate: body.expiryDate ? new Date(body.expiryDate) : undefined,
      status: body.expiryDate ? deriveStatus(new Date(body.expiryDate)) : undefined,
    },
  });

  await recordAudit({
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "licence.updated",
    entityType: "SiaLicence",
    entityId: id,
  });

  return c.json(updated);
});
