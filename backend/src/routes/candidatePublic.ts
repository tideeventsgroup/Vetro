import { Hono } from "hono";
import { getDb } from "../db/client.js";
import { recordAudit } from "../lib/audit.js";
import { createUploadUrl } from "../lib/documents.js";
import type { AppEnv } from "../lib/hono-env.js";

// Fully public, no Cognito session — a candidate's inviteToken (see
// generateInviteToken in routes/candidates.ts) is the only thing standing
// in for an account. Mounted under its own path in app.ts, ahead of the
// requireAuth gate, the same way vettingInvitePublic/pinAccess used to be
// for the old Officer model.
export const candidatePublic = new Hono<AppEnv>();

async function findCandidateByToken(token: string) {
  const db = await getDb();
  return db.candidate.findUnique({
    where: { inviteToken: token },
    include: {
      organisation: true,
      roleType: true,
      checks: { include: { documents: true } },
    },
  });
}

candidatePublic.get("/public/candidates/:token", async (c) => {
  const candidate = await findCandidateByToken(c.req.param("token"));
  if (!candidate) return c.json({ error: "Invite not found" }, 404);
  return c.json(candidate);
});

candidatePublic.post("/public/candidates/:token/checks/:checkId/upload-url", async (c) => {
  const candidate = await findCandidateByToken(c.req.param("token"));
  if (!candidate) return c.json({ error: "Invite not found" }, 404);
  const check = candidate.checks.find((existing) => existing.id === c.req.param("checkId"));
  if (!check) return c.json({ error: "Check not found" }, 404);
  // DBS_CHECK is status-only — Lunara Screening never collects a document
  // against it (see prisma/schema.prisma's CheckType comment).
  if (check.checkType === "DBS_CHECK") {
    return c.json({ error: "This check does not accept documents" }, 400);
  }

  const body = await c.req.json<{ fileName: string; contentType: string }>();
  if (!body.fileName?.trim() || !body.contentType?.trim()) {
    return c.json({ error: "fileName and contentType are required" }, 400);
  }

  const { uploadUrl, s3Key } = await createUploadUrl({
    prefix: `candidates/${candidate.id}/checks/${check.id}`,
    fileName: body.fileName,
    contentType: body.contentType,
  });
  return c.json({ uploadUrl, storagePath: s3Key });
});

// Second step of the presigned upload: record the document once it's
// actually landed in S3, and take whatever check-specific details came
// with it (SIA licence number, an expiry date) — a check moves out of
// NOT_STARTED into PENDING here, ready for an admin/reviewer to work off
// the review queue (routes/candidates.ts).
candidatePublic.post("/public/candidates/:token/checks/:checkId/documents", async (c) => {
  const db = await getDb();
  const candidate = await findCandidateByToken(c.req.param("token"));
  if (!candidate) return c.json({ error: "Invite not found" }, 404);
  const check = candidate.checks.find((existing) => existing.id === c.req.param("checkId"));
  if (!check) return c.json({ error: "Check not found" }, 404);
  if (check.checkType === "DBS_CHECK") {
    return c.json({ error: "This check does not accept documents" }, 400);
  }

  const body = await c.req.json<{
    storagePath: string;
    fileName: string;
    fileType?: string;
    licenceNumber?: string;
    expiryDate?: string;
  }>();
  if (!body.storagePath?.trim() || !body.fileName?.trim()) {
    return c.json({ error: "storagePath and fileName are required" }, 400);
  }

  await db.document.create({
    data: {
      checkId: check.id,
      storagePath: body.storagePath,
      fileName: body.fileName,
      fileType: body.fileType,
    },
  });

  await db.check.update({
    where: { id: check.id },
    data: {
      status: "PENDING",
      ...(body.licenceNumber !== undefined && { licenceNumber: body.licenceNumber }),
      ...(body.expiryDate !== undefined && { expiryDate: body.expiryDate ? new Date(body.expiryDate) : null }),
    },
  });

  await db.candidate.update({
    where: { id: candidate.id },
    data: { status: candidate.status === "INVITED" ? "IN_PROGRESS" : undefined },
  });

  await recordAudit({
    organisationId: candidate.organisationId,
    actorEmail: candidate.email,
    action: "document.uploaded",
    entityType: "Check",
    entityId: check.id,
    metadata: { checkType: check.checkType },
  });

  return c.json({ ok: true }, 201);
});

// Marks the candidate's own side of the form as done — doesn't change any
// individual check's status (those already moved to PENDING as each
// document/detail came in), just flips the overall record so the org
// admin's dashboard knows there's nothing left to chase from the
// candidate's end.
candidatePublic.post("/public/candidates/:token/submit", async (c) => {
  const db = await getDb();
  const candidate = await findCandidateByToken(c.req.param("token"));
  if (!candidate) return c.json({ error: "Invite not found" }, 404);

  const updated = await db.candidate.update({
    where: { id: candidate.id },
    data: { status: "SUBMITTED" },
  });

  await recordAudit({
    organisationId: candidate.organisationId,
    actorEmail: candidate.email,
    action: "candidate.submitted",
    entityType: "Candidate",
    entityId: candidate.id,
  });

  return c.json(updated);
});

// GDPR self-service: a candidate can always see everything held about them
// via the same GET above, and can raise an access or deletion request here
// — worked off by an org admin/reviewer in routes/dataRequests.ts.
candidatePublic.post("/public/candidates/:token/data-requests", async (c) => {
  const db = await getDb();
  const candidate = await findCandidateByToken(c.req.param("token"));
  if (!candidate) return c.json({ error: "Invite not found" }, 404);

  const body = await c.req.json<{ type: "ACCESS" | "DELETE" }>();
  if (body.type !== "ACCESS" && body.type !== "DELETE") {
    return c.json({ error: "type must be ACCESS or DELETE" }, 400);
  }

  const created = await db.dataRequest.create({
    data: { candidateId: candidate.id, organisationId: candidate.organisationId, type: body.type },
  });

  await recordAudit({
    organisationId: candidate.organisationId,
    actorEmail: candidate.email,
    action: "data_request.raised",
    entityType: "DataRequest",
    entityId: created.id,
    metadata: { type: body.type },
  });

  return c.json(created, 201);
});
