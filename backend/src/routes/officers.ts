import { Hono } from "hono";
import { getDb } from "../db/client.js";
import { recordAudit } from "../lib/audit.js";
import type { AppEnv } from "../lib/hono-env.js";

export const officers = new Hono<AppEnv>();

officers.get("/", async (c) => {
  const db = await getDb();
  const contractorId = c.req.query("contractorId");
  const rows = await db.officer.findMany({
    where: contractorId ? { contractorId } : undefined,
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
  if (!row) return c.json({ error: "Officer not found" }, 404);
  return c.json(row);
});

officers.post("/", async (c) => {
  const db = await getDb();
  const body = await c.req.json<{
    contractorId: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
  }>();

  const created = await db.officer.create({ data: body });
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
  await db.officer.delete({ where: { id } });
  await recordAudit({
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "officer.deleted",
    entityType: "Officer",
    entityId: id,
  });
  return c.body(null, 204);
});
