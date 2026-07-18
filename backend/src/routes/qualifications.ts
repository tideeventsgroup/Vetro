import { Hono } from "hono";
import { getDb } from "../db/client.js";
import { recordAudit } from "../lib/audit.js";
import type { AppEnv } from "../lib/hono-env.js";

export const qualifications = new Hono<AppEnv>();

qualifications.post("/officers/:officerId/qualifications", async (c) => {
  const db = await getDb();
  const officerId = c.req.param("officerId");
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
  const body = await c.req.json<Partial<{ name: string; issuedBy: string; expiryDate: string }>>();

  const updated = await db.qualification.update({
    where: { id },
    data: {
      ...body,
      expiryDate: body.expiryDate ? new Date(body.expiryDate) : undefined,
    },
  });

  await recordAudit({
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
  await db.qualification.delete({ where: { id } });
  await recordAudit({
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "qualification.deleted",
    entityType: "Qualification",
    entityId: id,
  });
  return c.body(null, 204);
});
