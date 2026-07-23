import crypto from "node:crypto";
import type { CheckStatus, CheckType } from "@prisma/client";
import { Hono } from "hono";
import { getDb } from "../db/client.js";
import { recordAudit } from "../lib/audit.js";
import { createDownloadUrl } from "../lib/documents.js";
import type { AppEnv } from "../lib/hono-env.js";

export const candidates = new Hono<AppEnv>();

function generateInviteToken(): string {
  // Long and random enough to be unguessable — this token alone grants
  // access to a public, unauthenticated self-service form (see
  // routes/candidatePublic.ts) and is the only thing standing in for a
  // candidate account.
  return crypto.randomBytes(24).toString("hex");
}

candidates.get("/", async (c) => {
  const db = await getDb();
  const rows = await db.candidate.findMany({
    where: { organisationId: c.get("organisationId") },
    include: { roleType: true, checks: true },
    orderBy: { createdAt: "desc" },
  });
  return c.json(rows);
});

candidates.get("/:id", async (c) => {
  const db = await getDb();
  const row = await db.candidate.findUnique({
    where: { id: c.req.param("id") },
    include: { roleType: true, checks: { include: { documents: true } } },
  });
  if (!row || row.organisationId !== c.get("organisationId")) return c.json({ error: "Candidate not found" }, 404);
  return c.json(row);
});

// Inviting a candidate creates one Check row per required check on their
// role type up front (all NOT_STARTED) — so the dashboard and their own
// self-service form both already know the full checklist before they've
// submitted anything.
candidates.post("/", async (c) => {
  const db = await getDb();
  const organisationId = c.get("organisationId")!;
  const body = await c.req.json<{ firstName: string; lastName: string; email: string; roleTypeId?: string }>();
  if (!body.firstName?.trim() || !body.lastName?.trim() || !body.email?.trim()) {
    return c.json({ error: "firstName, lastName, and email are required" }, 400);
  }

  let requiredCheckTypes: CheckType[] = [];
  if (body.roleTypeId) {
    const roleType = await db.roleType.findUnique({ where: { id: body.roleTypeId } });
    if (!roleType || roleType.organisationId !== organisationId) {
      return c.json({ error: "Role type not found" }, 400);
    }
    requiredCheckTypes = roleType.requiredCheckTypes;
  }

  const created = await db.candidate.create({
    data: {
      organisationId,
      firstName: body.firstName.trim(),
      lastName: body.lastName.trim(),
      email: body.email.trim(),
      roleTypeId: body.roleTypeId || undefined,
      inviteToken: generateInviteToken(),
      invitedByEmail: c.get("actorEmail") ?? "unknown",
      checks: { create: requiredCheckTypes.map((checkType) => ({ checkType })) },
    },
    include: { checks: true },
  });

  await recordAudit({
    organisationId,
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "candidate.invited",
    entityType: "Candidate",
    entityId: created.id,
  });

  return c.json(created, 201);
});

// Cascades onto their checks and documents (see the onDelete: Cascade
// relations in prisma/schema.prisma) — use a DataRequest (routes/dataRequests.ts)
// instead when the reason is an actual GDPR erasure request, so there's a
// record that it happened; this is the plain "remove a mistaken invite" path.
candidates.delete("/:id", async (c) => {
  const db = await getDb();
  const id = c.req.param("id");
  const existing = await db.candidate.findUnique({ where: { id } });
  if (!existing || existing.organisationId !== c.get("organisationId")) {
    return c.json({ error: "Candidate not found" }, 404);
  }

  await db.candidate.delete({ where: { id } });
  await recordAudit({
    organisationId: c.get("organisationId"),
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "candidate.deleted",
    entityType: "Candidate",
    entityId: id,
  });
  return c.body(null, 204);
});

// The review queue's core action: approve, reject, or send back to pending
// ("request more info") against one check. For SIA_LICENCE this is where an
// admin confirms they've cross-checked the licence number against the
// official public Register of Licence Holders — there's no public API to
// automate that lookup (see app/src/routes/CandidateDetail.tsx's "Check on
// the SIA register" link), so this is a deliberate human confirmation, not
// a live automated check.
const REVIEW_STATUSES: CheckStatus[] = ["VERIFIED", "REJECTED", "PENDING"];

candidates.patch("/:id/checks/:checkId", async (c) => {
  const db = await getDb();
  const candidateId = c.req.param("id");
  const checkId = c.req.param("checkId");
  const candidate = await db.candidate.findUnique({ where: { id: candidateId } });
  if (!candidate || candidate.organisationId !== c.get("organisationId")) {
    return c.json({ error: "Candidate not found" }, 404);
  }
  const check = await db.check.findUnique({ where: { id: checkId } });
  if (!check || check.candidateId !== candidateId) return c.json({ error: "Check not found" }, 404);

  const body = await c.req.json<{
    status?: CheckStatus;
    notes?: string;
    expiryDate?: string;
    licenceNumber?: string;
  }>();
  if (body.status && !REVIEW_STATUSES.includes(body.status)) {
    return c.json({ error: `status must be one of: ${REVIEW_STATUSES.join(", ")}` }, 400);
  }

  const actorEmail = c.get("actorEmail") ?? "unknown";
  const updated = await db.check.update({
    where: { id: checkId },
    data: {
      ...(body.status !== undefined && { status: body.status }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.expiryDate !== undefined && { expiryDate: body.expiryDate ? new Date(body.expiryDate) : null }),
      ...(body.licenceNumber !== undefined && { licenceNumber: body.licenceNumber }),
      ...(body.status === "VERIFIED" && { verifiedAt: new Date(), verifiedBy: actorEmail }),
    },
  });

  await recordAudit({
    organisationId: c.get("organisationId"),
    actorEmail,
    action: "check.reviewed",
    entityType: "Check",
    entityId: checkId,
    metadata: { status: body.status, checkType: check.checkType },
  });

  return c.json(updated);
});

candidates.get("/:id/checks/:checkId/documents/:docId/download-url", async (c) => {
  const db = await getDb();
  const candidateId = c.req.param("id");
  const candidate = await db.candidate.findUnique({ where: { id: candidateId } });
  if (!candidate || candidate.organisationId !== c.get("organisationId")) {
    return c.json({ error: "Candidate not found" }, 404);
  }
  const doc = await db.document.findUnique({ where: { id: c.req.param("docId") }, include: { check: true } });
  if (!doc || doc.check.candidateId !== candidateId) return c.json({ error: "Document not found" }, 404);

  const downloadUrl = await createDownloadUrl(doc.storagePath);

  await recordAudit({
    organisationId: c.get("organisationId"),
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "document.viewed",
    entityType: "Document",
    entityId: doc.id,
  });

  return c.json({ downloadUrl });
});
