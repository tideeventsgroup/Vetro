import { Hono } from "hono";
import { getDb } from "../db/client.js";
import { recordAudit } from "../lib/audit.js";
import type { AppEnv } from "../lib/hono-env.js";

export const qualifications = new Hono<AppEnv>();

qualifications.post("/officers/:officerId/qualifications", async (c) => {
  const db = await getDb();
  const officerId = c.req.param("officerId");
  const officer = await db.officer.findUnique({ where: { id: officerId } });
  if (!officer || officer.contractorId !== c.get("contractorId")) {
    return c.json({ error: "Officer not found" }, 404);
  }

  const body = await c.req.json<{
    name: string;
    issuedBy?: string;
    issueDate?: string;
    expiryDate?: string;
  }>();

  const created = await db.qualification.create({
    data: {
      officerId,
      name: body.name,
      issuedBy: body.issuedBy,
      issueDate: body.issueDate ? new Date(body.issueDate) : undefined,
      expiryDate: body.expiryDate ? new Date(body.expiryDate) : undefined,
    },
  });

  await recordAudit({
    contractorId: c.get("contractorId"),
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "qualification.created",
    entityType: "Qualification",
    entityId: created.id,
  });

  return c.json(created, 201);
});

qualifications.patch("/qualifications/:id", async (c) => {
  const db = await getDb();
  const id = c.req.param("id");
  const existing = await db.qualification.findUnique({ where: { id }, include: { officer: true } });
  if (!existing || existing.officer.contractorId !== c.get("contractorId")) {
    return c.json({ error: "Qualification not found" }, 404);
  }

  const body = await c.req.json<Partial<{ name: string; issuedBy: string; expiryDate: string }>>();

  const updated = await db.qualification.update({
    where: { id },
    data: {
      ...body,
      expiryDate: body.expiryDate ? new Date(body.expiryDate) : undefined,
    },
  });

  await recordAudit({
    contractorId: c.get("contractorId"),
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "qualification.updated",
    entityType: "Qualification",
    entityId: id,
  });

  return c.json(updated);
});

qualifications.delete("/qualifications/:id", async (c) => {
  const db = await getDb();
  const id = c.req.param("id");
  const existing = await db.qualification.findUnique({ where: { id }, include: { officer: true } });
  if (!existing || existing.officer.contractorId !== c.get("contractorId")) {
    return c.json({ error: "Qualification not found" }, 404);
  }

  await db.qualification.delete({ where: { id } });
  await recordAudit({
    contractorId: c.get("contractorId"),
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "qualification.deleted",
    entityType: "Qualification",
    entityId: id,
  });
  return c.body(null, 204);
});
