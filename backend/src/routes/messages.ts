import { Hono } from "hono";
import { getDb } from "../db/client.js";
import { recordAudit } from "../lib/audit.js";
import type { AppEnv } from "../lib/hono-env.js";

// Dispatch messaging, admin side: send a broadcast (recipientId omitted) or
// a direct message to one officer. Read receipts are officer-side only (see
// routes/me.ts) — an admin sees who a message went to, not who's read it,
// since this is a one-way control-room-to-field channel for now.
export const messages = new Hono<AppEnv>();

messages.get("/messages", async (c) => {
  const db = await getDb();
  const rows = await db.message.findMany({
    where: { contractorId: c.get("contractorId") },
    include: { recipient: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return c.json(rows);
});

messages.post("/messages", async (c) => {
  const db = await getDb();
  const contractorId = c.get("contractorId")!;
  const body = await c.req.json<{ recipientId?: string; body: string }>();
  if (!body.body?.trim()) return c.json({ error: "body is required" }, 400);

  if (body.recipientId) {
    const officer = await db.officer.findUnique({ where: { id: body.recipientId } });
    if (!officer || officer.contractorId !== contractorId) {
      return c.json({ error: "Officer not found" }, 404);
    }
  }

  const created = await db.message.create({
    data: {
      contractorId,
      senderEmail: c.get("actorEmail") ?? "unknown",
      recipientId: body.recipientId ?? null,
      body: body.body.trim(),
    },
    include: { recipient: true },
  });

  await recordAudit({
    contractorId,
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: body.recipientId ? "message.sent" : "message.broadcast",
    entityType: "Message",
    entityId: created.id,
  });

  return c.json(created, 201);
});
