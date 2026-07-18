import { Hono } from "hono";
import { getDb } from "../db/client.js";
import { recordAudit } from "../lib/audit.js";
import type { AppEnv } from "../lib/hono-env.js";

export const shifts = new Hono<AppEnv>();

// ?siteId= and ?from=/?to= (ISO dates) narrow the roster — a bare GET
// returns everything, which is fine at the volumes one org's roster implies.
shifts.get("/shifts", async (c) => {
  const db = await getDb();
  const siteId = c.req.query("siteId");
  const from = c.req.query("from");
  const to = c.req.query("to");

  const rows = await db.shift.findMany({
    where: {
      contractorId: c.get("contractorId"),
      ...(siteId ? { siteId } : {}),
      ...(from || to
        ? {
            startTime: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    },
    include: { site: true, officer: true },
    orderBy: { startTime: "asc" },
  });
  return c.json(rows);
});

shifts.post("/shifts", async (c) => {
  const db = await getDb();
  const contractorId = c.get("contractorId")!;
  const body = await c.req.json<{
    siteId: string;
    officerId?: string;
    startTime: string;
    endTime: string;
  }>();
  if (!body.siteId || !body.startTime || !body.endTime) {
    return c.json({ error: "siteId, startTime and endTime are required" }, 400);
  }

  const site = await db.site.findUnique({ where: { id: body.siteId } });
  if (!site || site.contractorId !== contractorId) return c.json({ error: "Site not found" }, 404);

  if (body.officerId) {
    const officer = await db.officer.findUnique({ where: { id: body.officerId } });
    if (!officer || officer.contractorId !== contractorId) return c.json({ error: "Officer not found" }, 404);
  }

  const created = await db.shift.create({
    data: {
      contractorId,
      siteId: body.siteId,
      officerId: body.officerId,
      startTime: new Date(body.startTime),
      endTime: new Date(body.endTime),
    },
    include: { site: true, officer: true },
  });

  await recordAudit({
    contractorId,
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "shift.created",
    entityType: "Shift",
    entityId: created.id,
  });

  return c.json(created, 201);
});

shifts.patch("/shifts/:id", async (c) => {
  const db = await getDb();
  const id = c.req.param("id");
  const contractorId = c.get("contractorId")!;
  const existing = await db.shift.findUnique({ where: { id } });
  if (!existing || existing.contractorId !== contractorId) return c.json({ error: "Shift not found" }, 404);

  const body = await c.req.json<
    Partial<{
      officerId: string | null;
      startTime: string;
      endTime: string;
      status: "SCHEDULED" | "CONFIRMED" | "COMPLETED" | "MISSED" | "LATE";
    }>
  >();

  if (body.officerId) {
    const officer = await db.officer.findUnique({ where: { id: body.officerId } });
    if (!officer || officer.contractorId !== contractorId) return c.json({ error: "Officer not found" }, 404);
  }

  const updated = await db.shift.update({
    where: { id },
    data: {
      ...body,
      startTime: body.startTime ? new Date(body.startTime) : undefined,
      endTime: body.endTime ? new Date(body.endTime) : undefined,
    },
    include: { site: true, officer: true },
  });

  await recordAudit({
    contractorId,
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "shift.updated",
    entityType: "Shift",
    entityId: id,
  });

  return c.json(updated);
});

shifts.delete("/shifts/:id", async (c) => {
  const db = await getDb();
  const id = c.req.param("id");
  const existing = await db.shift.findUnique({ where: { id } });
  if (!existing || existing.contractorId !== c.get("contractorId")) {
    return c.json({ error: "Shift not found" }, 404);
  }

  await db.shift.delete({ where: { id } });
  await recordAudit({
    contractorId: c.get("contractorId"),
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "shift.deleted",
    entityType: "Shift",
    entityId: id,
  });
  return c.body(null, 204);
});
