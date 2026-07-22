import { Hono } from "hono";
import { getDb } from "../db/client.js";
import { recordAudit } from "../lib/audit.js";
import type { AppEnv } from "../lib/hono-env.js";

// Reference checks — a first-class, trackable counterpart to the free-text
// `references` blob an officer submits themselves in VettingSubmission.
// Unlike SiaLicence/DbsCheck, there's no expiry/status-drift concept here:
// a reference check either hasn't been responded to yet, has, or needs an
// admin's attention for one of two different reasons (see the
// ReferenceCheckStatus enum's own comment in schema.prisma).
export const referenceChecks = new Hono<AppEnv>();

const REFERENCE_CHECK_STATUSES = ["PENDING", "RECEIVED", "UNABLE_TO_CONTACT", "FLAGGED"] as const;

referenceChecks.post("/officers/:officerId/reference-checks", async (c) => {
  const db = await getDb();
  const officerId = c.req.param("officerId");
  const officer = await db.officer.findUnique({ where: { id: officerId } });
  if (!officer || officer.contractorId !== c.get("contractorId")) {
    return c.json({ error: "Officer not found" }, 404);
  }

  const body = await c.req.json<{
    refereeName: string;
    contact: string;
    relationship?: string;
  }>();
  if (!body.refereeName?.trim() || !body.contact?.trim()) {
    return c.json({ error: "refereeName and contact are required" }, 400);
  }

  const created = await db.referenceCheck.create({
    data: {
      officerId,
      refereeName: body.refereeName.trim(),
      contact: body.contact.trim(),
      relationship: body.relationship?.trim() || null,
    },
  });

  await recordAudit({
    contractorId: c.get("contractorId"),
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "reference_check.created",
    entityType: "ReferenceCheck",
    entityId: created.id,
  });

  return c.json(created, 201);
});

referenceChecks.patch("/reference-checks/:id", async (c) => {
  const db = await getDb();
  const id = c.req.param("id");
  const existing = await db.referenceCheck.findUnique({ where: { id }, include: { officer: true } });
  if (!existing || existing.officer.contractorId !== c.get("contractorId")) {
    return c.json({ error: "Reference check not found" }, 404);
  }

  const body = await c.req.json<Partial<{ status: string; notes: string }>>();
  if (body.status && !REFERENCE_CHECK_STATUSES.includes(body.status as (typeof REFERENCE_CHECK_STATUSES)[number])) {
    return c.json({ error: `status must be one of: ${REFERENCE_CHECK_STATUSES.join(", ")}` }, 400);
  }

  // Moving out of PENDING for the first time is what "responded" means here
  // — set respondedAt then, not on every subsequent edit (e.g. adding notes
  // to an already-RECEIVED check shouldn't push its response time forward).
  const justResponded = body.status && body.status !== "PENDING" && existing.status === "PENDING";

  const updated = await db.referenceCheck.update({
    where: { id },
    data: {
      ...(body.status !== undefined && { status: body.status as (typeof REFERENCE_CHECK_STATUSES)[number] }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(justResponded && { respondedAt: new Date() }),
    },
  });

  await recordAudit({
    contractorId: c.get("contractorId"),
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "reference_check.updated",
    entityType: "ReferenceCheck",
    entityId: id,
  });

  return c.json(updated);
});
