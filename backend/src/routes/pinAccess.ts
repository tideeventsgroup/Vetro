import type { Prisma } from "@prisma/client";
import { Hono } from "hono";
import { getDb } from "../db/client.js";
import { recordAudit } from "../lib/audit.js";
import { createUploadUrl } from "../lib/documents.js";
import type { AppEnv } from "../lib/hono-env.js";

// An officer's own way into their vetting record — no Cognito account
// needed, just the PIN they were given when added (see Officer.pin in
// prisma/schema.prisma). Deliberately no requireAuth/requireContractor here,
// same reasoning as routes/vettingInvitePublic.ts: the PIN itself, not a
// session, is what authorises this. The tenant slug comes from the
// pin-access page's own URL (see app/src/routes/PinAccess.tsx) since a PIN
// alone isn't globally unique — every request here re-verifies both
// together rather than issuing a session token.
export const pinAccess = new Hono<AppEnv>();

async function resolveOfficer(tenantSlug: string, pin: string) {
  const db = await getDb();
  const contractor = await db.contractor.findUnique({ where: { slug: tenantSlug } });
  if (!contractor) return undefined;
  const officer = await db.officer.findFirst({ where: { contractorId: contractor.id, pin } });
  if (!officer) return undefined;
  return { db, contractor, officer };
}

pinAccess.post("/pin-access/:tenantSlug/verify", async (c) => {
  const body = await c.req.json<{ pin?: string }>();
  if (!body.pin) return c.json({ error: "pin is required" }, 400);

  const resolved = await resolveOfficer(c.req.param("tenantSlug"), body.pin);
  if (!resolved) return c.json({ error: "Incorrect PIN" }, 400);
  const { db, contractor, officer } = resolved;

  const [vettingSubmissions, documents] = await Promise.all([
    db.vettingSubmission.findMany({ where: { officerId: officer.id }, orderBy: { submittedAt: "desc" } }),
    db.document.findMany({ where: { officerId: officer.id }, select: { id: true, kind: true, uploadedAt: true } }),
  ]);

  return c.json({
    organisationName: contractor.name,
    firstName: officer.firstName,
    lastName: officer.lastName,
    vettingRecords: await db.vettingRecord.findMany({ where: { officerId: officer.id } }),
    dbsChecks: await db.dbsCheck.findMany({ where: { officerId: officer.id } }),
    rightToWorkConfirmed: officer.rightToWorkConfirmed,
    rightToWorkExpiryDate: officer.rightToWorkExpiryDate,
    vettingSubmissions,
    documents,
  });
});

// What the officer submits themselves — Vetro still doesn't perform the
// BS7858 check; this sits as PENDING_REVIEW until an admin reviews it (see
// VettingSubmission in prisma/schema.prisma and routes/vettingSubmissions.ts).
pinAccess.post("/pin-access/:tenantSlug/vetting-submission", async (c) => {
  const body = await c.req.json<{
    pin?: string;
    addressHistory: Prisma.InputJsonValue;
    employmentHistory: Prisma.InputJsonValue;
    references: Prisma.InputJsonValue;
    consentGiven: boolean;
  }>();
  if (!body.pin) return c.json({ error: "pin is required" }, 400);
  if (!body.consentGiven) return c.json({ error: "consentGiven must be true to submit" }, 400);

  const resolved = await resolveOfficer(c.req.param("tenantSlug"), body.pin);
  if (!resolved) return c.json({ error: "Incorrect PIN" }, 400);
  const { db, contractor, officer } = resolved;

  const created = await db.vettingSubmission.create({
    data: {
      officerId: officer.id,
      addressHistory: body.addressHistory,
      employmentHistory: body.employmentHistory,
      references: body.references,
      consentGiven: body.consentGiven,
    },
  });

  await recordAudit({
    contractorId: contractor.id,
    actorEmail: officer.email ?? `officer:${officer.id}`,
    action: "vetting_submission.created",
    entityType: "VettingSubmission",
    entityId: created.id,
  });

  return c.json(created, 201);
});

// Same two-step presigned upload as the admin-facing documents route
// (lib/documents.ts) and the candidate-invite flow (vettingInvitePublic.ts),
// just scoped to the PIN-resolved officerId instead.
pinAccess.post("/pin-access/:tenantSlug/documents/upload-url", async (c) => {
  const body = await c.req.json<{ pin?: string; fileName: string; contentType: string }>();
  if (!body.pin) return c.json({ error: "pin is required" }, 400);

  const resolved = await resolveOfficer(c.req.param("tenantSlug"), body.pin);
  if (!resolved) return c.json({ error: "Incorrect PIN" }, 400);
  const { officer } = resolved;

  const { uploadUrl, s3Key } = await createUploadUrl({
    prefix: `officers/${officer.id}`,
    fileName: body.fileName,
    contentType: body.contentType,
  });
  return c.json({ uploadUrl, s3Key });
});

pinAccess.post("/pin-access/:tenantSlug/documents", async (c) => {
  const body = await c.req.json<{ pin?: string; kind: string; s3Key: string }>();
  if (!body.pin) return c.json({ error: "pin is required" }, 400);

  const resolved = await resolveOfficer(c.req.param("tenantSlug"), body.pin);
  if (!resolved) return c.json({ error: "Incorrect PIN" }, 400);
  const { db, contractor, officer } = resolved;

  const created = await db.document.create({ data: { officerId: officer.id, kind: body.kind, s3Key: body.s3Key } });

  await recordAudit({
    contractorId: contractor.id,
    actorEmail: officer.email ?? `officer:${officer.id}`,
    action: "document.created",
    entityType: "Document",
    entityId: created.id,
  });

  return c.json(created, 201);
});
