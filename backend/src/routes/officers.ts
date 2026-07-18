import { Hono } from "hono";
import { getDb } from "../db/client.js";
import { recordAudit } from "../lib/audit.js";
import type { AppEnv } from "../lib/hono-env.js";

export const officers = new Hono<AppEnv>();

officers.get("/", async (c) => {
  const db = await getDb();
  const rows = await db.officer.findMany({
    where: { contractorId: c.get("contractorId") },
    include: { licences: true, vettingRecords: true },
    orderBy: { lastName: "asc" },
  });
  return c.json(rows);
});

officers.get("/:id", async (c) => {
  const db = await getDb();
  const row = await db.officer.findUnique({
    where: { id: c.req.param("id") },
    include: { licences: true, vettingRecords: true, qualifications: true, documents: true },
  });
  if (!row || row.contractorId !== c.get("contractorId")) return c.json({ error: "Officer not found" }, 404);
  return c.json(row);
});

officers.post("/", async (c) => {
  const db = await getDb();
  const body = await c.req.json<{
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
  }>();

  const created = await db.officer.create({ data: { ...body, contractorId: c.get("contractorId")! } });
  await recordAudit({
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "officer.created",
    entityType: "Officer",
    entityId: created.id,
  });
  return c.json(created, 201);
});

officers.patch("/:id", async (c) => {
  const db = await getDb();
  const id = c.req.param("id");
  const existing = await db.officer.findUnique({ where: { id } });
  if (!existing || existing.contractorId !== c.get("contractorId")) {
    return c.json({ error: "Officer not found" }, 404);
  }

  const body = await c.req.json<Partial<{ firstName: string; lastName: string; email: string; phone: string }>>();
  const updated = await db.officer.update({ where: { id }, data: body });
  await recordAudit({
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "officer.updated",
    entityType: "Officer",
    entityId: id,
  });
  return c.json(updated);
});

officers.delete("/:id", async (c) => {
  const db = await getDb();
  const id = c.req.param("id");
  const existing = await db.officer.findUnique({ where: { id } });
  if (!existing || existing.contractorId !== c.get("contractorId")) {
    return c.json({ error: "Officer not found" }, 404);
  }

  await db.officer.delete({ where: { id } });
  await recordAudit({
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "officer.deleted",
    entityType: "Officer",
    entityId: id,
  });
  return c.body(null, 204);
});
