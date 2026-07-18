import { Hono } from "hono";
import { getDb } from "../db/client.js";
import { recordAudit } from "../lib/audit.js";
import { buildInviteClientMetadata, CognitoUserExistsError, createCognitoUser } from "../lib/cognito.js";
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
    contractorId: c.get("contractorId"),
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
    contractorId: c.get("contractorId"),
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "officer.updated",
    entityType: "Officer",
    entityId: id,
  });
  return c.json(updated);
});

// Gives an officer their own login to the self-service vetting portal.
// Vetro still never performs the BS7858 check itself — this just lets the
// officer submit their own details/documents for an admin to review (see
// VettingSubmission in prisma/schema.prisma and the /me/* routes it feeds).
officers.post("/:id/invite", async (c) => {
  const db = await getDb();
  const id = c.req.param("id");
  const officer = await db.officer.findUnique({ where: { id } });
  if (!officer || officer.contractorId !== c.get("contractorId")) {
    return c.json({ error: "Officer not found" }, 404);
  }

  const body = await c.req.json<{ email?: string }>().catch(() => ({}) as { email?: string });
  const email = body.email ?? officer.email;
  if (!email) {
    return c.json({ error: "Officer has no email on file — provide one to invite" }, 400);
  }
  if (email !== officer.email) {
    await db.officer.update({ where: { id }, data: { email } });
  }

  const contractor = await db.contractor.findUniqueOrThrow({ where: { id: officer.contractorId } });

  let temporaryPassword: string;
  try {
    ({ temporaryPassword } = await createCognitoUser({
      email,
      attributes: {
        "custom:contractor_id": officer.contractorId,
        "custom:role": "OFFICER",
        "custom:officer_id": officer.id,
      },
      clientMetadata: buildInviteClientMetadata(contractor),
    }));
  } catch (err) {
    if (err instanceof CognitoUserExistsError) return c.json({ error: err.message }, 409);
    throw err;
  }

  await recordAudit({
    contractorId: c.get("contractorId"),
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "officer.invited",
    entityType: "Officer",
    entityId: id,
  });

  return c.json({ status: "invited", email, temporaryPassword }, 201);
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
    contractorId: c.get("contractorId"),
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "officer.deleted",
    entityType: "Officer",
    entityId: id,
  });
  return c.body(null, 204);
});
