import { Hono } from "hono";
import { getDb } from "../db/client.js";
import type { AppEnv } from "../lib/hono-env.js";

export const organisations = new Hono<AppEnv>();

organisations.get("/me", async (c) => {
  const organisationId = c.get("organisationId");
  if (!organisationId) return c.json(null, 404);
  const db = await getDb();
  const organisation = await db.organisation.findUnique({ where: { id: organisationId } });
  return c.json(organisation);
});

// Not mounted behind the tenantAdminPrefixes gate (see app.ts) since GET
// /me above needs to work for REVIEWER logins too — gated inline instead.
// Renames and the retention period only; slug stays immutable so a
// bookmarked/shared org URL never silently breaks.
organisations.patch("/me", async (c) => {
  const organisationId = c.get("organisationId");
  if (!organisationId) return c.json({ error: "No organisation resolved for this account" }, 403);
  if (c.get("role") !== "ADMIN") return c.json({ error: "Admin access required" }, 403);

  const body = await c.req.json<{ name?: string; retentionDays?: number }>();
  const data: { name?: string; retentionDays?: number } = {};
  if (body.name !== undefined) {
    if (!body.name.trim()) return c.json({ error: "name cannot be empty" }, 400);
    data.name = body.name.trim();
  }
  if (body.retentionDays !== undefined) {
    if (!Number.isInteger(body.retentionDays) || body.retentionDays < 1) {
      return c.json({ error: "retentionDays must be a positive whole number" }, 400);
    }
    data.retentionDays = body.retentionDays;
  }

  const db = await getDb();
  const updated = await db.organisation.update({ where: { id: organisationId }, data });
  return c.json(updated);
});

// Self-serve tenant creation only makes sense in SKIP_AUTH dev mode, where
// tenantSlug comes straight from the request's subdomain with nothing to
// verify against yet. In a real deployment a user's custom:contractor_id
// claim is assigned out of band when their tenant is set up — there's no
// "first visit creates your tenant" flow to gate here.
organisations.post("/", async (c) => {
  const tenantSlug = c.get("tenantSlug");
  if (!tenantSlug) {
    return c.json({ error: "Tenant creation is only available in local development" }, 400);
  }

  const db = await getDb();
  const existing = await db.organisation.findUnique({ where: { slug: tenantSlug } });
  if (existing) return c.json({ error: "Tenant already exists" }, 409);

  const body = await c.req.json<{ name: string }>();
  const created = await db.organisation.create({ data: { name: body.name, slug: tenantSlug } });
  return c.json(created, 201);
});
