import type { CheckType } from "@prisma/client";
import { Hono } from "hono";
import { getDb } from "../db/client.js";
import { recordAudit } from "../lib/audit.js";
import type { AppEnv } from "../lib/hono-env.js";

export const roleTypes = new Hono<AppEnv>();

const CHECK_TYPES: CheckType[] = ["SIA_LICENCE", "FIRST_AID", "RIGHT_TO_WORK", "ID_DOCUMENT", "TRAINING", "DBS_CHECK"];

function parseCheckTypes(input: unknown): CheckType[] {
  if (!Array.isArray(input)) return [];
  return input.filter((v): v is CheckType => typeof v === "string" && CHECK_TYPES.includes(v as CheckType));
}

// An org's own configurable "what does this job need" mapping — chosen at
// candidate-invite time (routes/candidates.ts) so a candidate's self-service
// form only ever asks for the checks their actual role requires.
roleTypes.get("/role-types", async (c) => {
  const db = await getDb();
  const rows = await db.roleType.findMany({
    where: { organisationId: c.get("organisationId") },
    orderBy: { name: "asc" },
  });
  return c.json(rows);
});

roleTypes.post("/role-types", async (c) => {
  const db = await getDb();
  const organisationId = c.get("organisationId")!;
  const body = await c.req.json<{ name: string; requiredCheckTypes: unknown }>();
  if (!body.name?.trim()) return c.json({ error: "name is required" }, 400);
  const requiredCheckTypes = parseCheckTypes(body.requiredCheckTypes);
  if (requiredCheckTypes.length === 0) {
    return c.json({ error: "At least one check type is required" }, 400);
  }

  const created = await db.roleType.create({
    data: { organisationId, name: body.name.trim(), requiredCheckTypes },
  });

  await recordAudit({
    organisationId,
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "role_type.created",
    entityType: "RoleType",
    entityId: created.id,
  });

  return c.json(created, 201);
});

roleTypes.patch("/role-types/:id", async (c) => {
  const db = await getDb();
  const id = c.req.param("id");
  const existing = await db.roleType.findUnique({ where: { id } });
  if (!existing || existing.organisationId !== c.get("organisationId")) {
    return c.json({ error: "Role type not found" }, 404);
  }

  const body = await c.req.json<{ name?: string; requiredCheckTypes?: unknown }>();
  const data: { name?: string; requiredCheckTypes?: CheckType[] } = {};
  if (body.name !== undefined) {
    if (!body.name.trim()) return c.json({ error: "name cannot be empty" }, 400);
    data.name = body.name.trim();
  }
  if (body.requiredCheckTypes !== undefined) {
    const parsed = parseCheckTypes(body.requiredCheckTypes);
    if (parsed.length === 0) return c.json({ error: "At least one check type is required" }, 400);
    data.requiredCheckTypes = parsed;
  }

  const updated = await db.roleType.update({ where: { id }, data });
  return c.json(updated);
});

// Existing candidates on this role type keep their own checks untouched —
// only their roleTypeId is cleared (see the RoleType relation's onDelete:
// SetNull in prisma/schema.prisma), so deleting a role type never destroys
// anyone's compliance history.
roleTypes.delete("/role-types/:id", async (c) => {
  const db = await getDb();
  const id = c.req.param("id");
  const existing = await db.roleType.findUnique({ where: { id } });
  if (!existing || existing.organisationId !== c.get("organisationId")) {
    return c.json({ error: "Role type not found" }, 404);
  }

  await db.roleType.delete({ where: { id } });
  await recordAudit({
    organisationId: c.get("organisationId"),
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "role_type.deleted",
    entityType: "RoleType",
    entityId: id,
  });
  return c.body(null, 204);
});
