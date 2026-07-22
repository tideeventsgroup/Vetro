import { Hono } from "hono";
import { getDb } from "../db/client.js";
import { recordAudit } from "../lib/audit.js";
import { deriveStatus } from "../lib/status.js";
import type { AppEnv } from "../lib/hono-env.js";

// DBS certificate tracking — Vetro is not a DBS Registered Body and doesn't
// apply for or perform the check itself, only tracks a certificate the org
// already holds, the same way routes/licences.ts tracks an SIA licence.
export const dbs = new Hono<AppEnv>();

const DBS_LEVELS = ["BASIC", "STANDARD", "ENHANCED"] as const;

dbs.post("/officers/:officerId/dbs", async (c) => {
  const db = await getDb();
  const officerId = c.req.param("officerId");
  const officer = await db.officer.findUnique({ where: { id: officerId } });
  if (!officer || officer.contractorId !== c.get("contractorId")) {
    return c.json({ error: "Officer not found" }, 404);
  }

  const body = await c.req.json<{
    level: string;
    certificateNumber: string;
    issueDate: string;
    expiryDate?: string;
  }>();
  if (!DBS_LEVELS.includes(body.level as (typeof DBS_LEVELS)[number])) {
    return c.json({ error: `level must be one of: ${DBS_LEVELS.join(", ")}` }, 400);
  }

  const expiryDate = body.expiryDate ? new Date(body.expiryDate) : null;
  const created = await db.dbsCheck.create({
    data: {
      officerId,
      level: body.level as (typeof DBS_LEVELS)[number],
      certificateNumber: body.certificateNumber,
      issueDate: new Date(body.issueDate),
      expiryDate,
      status: deriveStatus(expiryDate),
      lastCheckedAt: new Date(),
    },
  });

  await recordAudit({
    contractorId: c.get("contractorId"),
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "dbs.created",
    entityType: "DbsCheck",
    entityId: created.id,
  });

  return c.json(created, 201);
});

dbs.patch("/dbs/:id", async (c) => {
  const db = await getDb();
  const id = c.req.param("id");
  const existing = await db.dbsCheck.findUnique({ where: { id }, include: { officer: true } });
  if (!existing || existing.officer.contractorId !== c.get("contractorId")) {
    return c.json({ error: "DBS check not found" }, 404);
  }

  const body = await c.req.json<Partial<{ certificateNumber: string; expiryDate: string }>>();
  const expiryDate = body.expiryDate ? new Date(body.expiryDate) : undefined;

  const updated = await db.dbsCheck.update({
    where: { id },
    data: {
      ...body,
      expiryDate,
      status: expiryDate ? deriveStatus(expiryDate) : undefined,
      lastCheckedAt: new Date(),
    },
  });

  await recordAudit({
    contractorId: c.get("contractorId"),
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "dbs.updated",
    entityType: "DbsCheck",
    entityId: id,
  });

  return c.json(updated);
});
