import { Hono } from "hono";
import { getDb } from "../db/client.js";
import type { AppEnv } from "../lib/hono-env.js";

export const contractors = new Hono<AppEnv>();

contractors.get("/me", async (c) => {
  const contractorId = c.get("contractorId");
  if (!contractorId) return c.json(null, 404);
  const db = await getDb();
  const contractor = await db.contractor.findUnique({ where: { id: contractorId } });
  return c.json(contractor);
});

// Self-serve tenant creation only makes sense in SKIP_AUTH dev mode, where
// tenantSlug comes straight from the request's subdomain with nothing to
// verify against yet. In a real deployment a user's custom:contractor_id
// claim is assigned out of band when their tenant is set up — there's no
// "first visit creates your tenant" flow to gate here.
contractors.post("/", async (c) => {
  const tenantSlug = c.get("tenantSlug");
  if (!tenantSlug) {
    return c.json({ error: "Tenant creation is only available in local development" }, 400);
  }

  const db = await getDb();
  const existing = await db.contractor.findUnique({ where: { slug: tenantSlug } });
  if (existing) return c.json({ error: "Tenant already exists" }, 409);

  const body = await c.req.json<{ name: string }>();
  const created = await db.contractor.create({ data: { name: body.name, slug: tenantSlug } });
  return c.json(created, 201);
});
