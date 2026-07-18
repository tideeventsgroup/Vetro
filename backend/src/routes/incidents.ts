import type { IncidentCategory } from "@prisma/client";
import { Hono } from "hono";
import { getDb } from "../db/client.js";
import { createDownloadUrl } from "../lib/documents.js";
import type { AppEnv } from "../lib/hono-env.js";

// Admin-side read access to what officers file from the self-service portal
// (routes/me.ts handles creation) — filing stays with whoever was on-site,
// reviewing is an admin/ACS-inspection concern.
export const incidents = new Hono<AppEnv>();

incidents.get("/incidents", async (c) => {
  const db = await getDb();
  const siteId = c.req.query("siteId");
  const category = c.req.query("category");
  const from = c.req.query("from");
  const to = c.req.query("to");

  const rows = await db.incident.findMany({
    where: {
      contractorId: c.get("contractorId"),
      ...(siteId ? { siteId } : {}),
      ...(category ? { category: category as IncidentCategory } : {}),
      ...(from || to
        ? {
            occurredAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    },
    include: { site: true, officer: true },
    orderBy: { occurredAt: "desc" },
  });
  return c.json(rows);
});

incidents.get("/incidents/:id", async (c) => {
  const db = await getDb();
  const incident = await db.incident.findUnique({
    where: { id: c.req.param("id") },
    include: { site: true, officer: true },
  });
  if (!incident || incident.contractorId !== c.get("contractorId")) {
    return c.json({ error: "Incident not found" }, 404);
  }
  return c.json(incident);
});

incidents.get("/incidents/:id/photo-url", async (c) => {
  const db = await getDb();
  const id = c.req.param("id");
  const key = c.req.query("key");
  if (!key) return c.json({ error: "key is required" }, 400);

  const incident = await db.incident.findUnique({ where: { id } });
  if (!incident || incident.contractorId !== c.get("contractorId") || !incident.photoKeys.includes(key)) {
    return c.json({ error: "Photo not found" }, 404);
  }
  const downloadUrl = await createDownloadUrl(key);
  return c.json({ downloadUrl });
});
