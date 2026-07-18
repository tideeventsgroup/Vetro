import { Hono } from "hono";
import { getDb } from "../db/client.js";
import type { AppEnv } from "../lib/hono-env.js";

// Read-only admin view across every site — officers sign visitors in/out
// from the self-service portal (routes/me.ts); this is the compliance/audit
// side of the same register.
export const visitorLog = new Hono<AppEnv>();

visitorLog.get("/visitor-log", async (c) => {
  const db = await getDb();
  const siteId = c.req.query("siteId");
  const from = c.req.query("from");
  const to = c.req.query("to");

  const rows = await db.visitorLogEntry.findMany({
    where: {
      contractorId: c.get("contractorId"),
      ...(siteId ? { siteId } : {}),
      ...(from || to
        ? {
            signedInAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    },
    include: { site: true, officer: true },
    orderBy: { signedInAt: "desc" },
    take: 200,
  });
  return c.json(rows);
});
