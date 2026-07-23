import { Hono } from "hono";
import { getDb } from "../db/client.js";
import type { AppEnv } from "../lib/hono-env.js";

export const auditLog = new Hono<AppEnv>();

// What a client due-diligence request actually asks for: a plain,
// unfiltered history of who did what — status changes, document views,
// everything. Most recent first, capped — this is a read-back for humans,
// not a paginated export.
auditLog.get("/audit-log", async (c) => {
  const db = await getDb();
  const rows = await db.auditLogEntry.findMany({
    where: { organisationId: c.get("organisationId") },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return c.json(rows);
});
