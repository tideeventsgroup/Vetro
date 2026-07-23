import crypto from "node:crypto";
import { Hono } from "hono";
import { getDb } from "../db/client.js";
import { recordAudit } from "../lib/audit.js";
import { createDownloadUrl } from "../lib/documents.js";
import { deriveStatus } from "../lib/status.js";
import type { AppEnv } from "../lib/hono-env.js";

export const vettingInvites = new Hono<AppEnv>();

function generateToken(): string {
  // Long and random enough to be unguessable — this token alone grants
  // write access to a public, unauthenticated form (see
  // routes/vettingInvitePublic.ts), unlike the short human-typed PIN/SIN
  // codes elsewhere in identityCodes.ts.
  return crypto.randomBytes(24).toString("hex");
}

// The admin side of "send a candidate a link before they're added to the
// roster" — see VettingInvite in prisma/schema.prisma. Candidates fill in
// the same BS7858-style questions an already-added officer would through
// self-service (routes/me.ts's vetting-submissions), just before an Officer
// row for them exists at all.
vettingInvites.get("/vetting-invites", async (c) => {
  const db = await getDb();
  const rows = await db.vettingInvite.findMany({
    where: { contractorId: c.get("contractorId") },
    include: { documents: { select: { id: true, kind: true, fileName: true } } },
    orderBy: { createdAt: "desc" },
  });
  return c.json(rows);
});

vettingInvites.get("/vetting-invites/:id/documents/:docId/download-url", async (c) => {
  const db = await getDb();
  const invite = await db.vettingInvite.findUnique({ where: { id: c.req.param("id") } });
  if (!invite || invite.contractorId !== c.get("contractorId")) {
    return c.json({ error: "Invite not found" }, 404);
  }
  const doc = await db.vettingInviteDocument.findUnique({ where: { id: c.req.param("docId") } });
  if (!doc || doc.vettingInviteId !== invite.id) return c.json({ error: "Document not found" }, 404);

  const downloadUrl = await createDownloadUrl(doc.s3Key);
  return c.json({ downloadUrl });
});

vettingInvites.post("/vetting-invites", async (c) => {
  const db = await getDb();
  const body = await c.req.json<{
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    requiresDbs?: boolean;
    requiresRightToWork?: boolean;
  }>();
  if (!body.firstName?.trim() || !body.lastName?.trim() || !body.email?.trim()) {
    return c.json({ error: "firstName, lastName, and email are required" }, 400);
  }

  const created = await db.vettingInvite.create({
    data: {
      contractorId: c.get("contractorId")!,
      firstName: body.firstName.trim(),
      lastName: body.lastName.trim(),
      email: body.email.trim(),
      phone: body.phone?.trim() || undefined,
      requiresDbs: body.requiresDbs ?? false,
      requiresRightToWork: body.requiresRightToWork ?? false,
      token: generateToken(),
      invitedByEmail: c.get("actorEmail") ?? "unknown",
    },
  });

  await recordAudit({
    contractorId: c.get("contractorId"),
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "vetting_invite.created",
    entityType: "VettingInvite",
    entityId: created.id,
  });

  return c.json(created, 201);
});

vettingInvites.delete("/vetting-invites/:id", async (c) => {
  const db = await getDb();
  const id = c.req.param("id");
  const existing = await db.vettingInvite.findUnique({ where: { id } });
  if (!existing || existing.contractorId !== c.get("contractorId")) {
    return c.json({ error: "Invite not found" }, 404);
  }
  if (existing.status === "CONVERTED") {
    return c.json({ error: "This candidate has already been added to the roster" }, 409);
  }

  await db.vettingInvite.delete({ where: { id } });

  await recordAudit({
    contractorId: c.get("contractorId"),
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "vetting_invite.revoked",
    entityType: "VettingInvite",
    entityId: id,
  });

  return c.body(null, 204);
});

// Turns a candidate's submitted answers into the real thing: an Officer row
// (what "added to the shift system" means everywhere else in the app) plus
// a VettingSubmission carrying over what they submitted, so it lands in the
// same PENDING_REVIEW queue as a self-service submission from an officer
// who was already on the roster (see routes/vettingSubmissions.ts) — the
// admin still makes the final approve/reject call there, same as today.
vettingInvites.post("/vetting-invites/:id/convert", async (c) => {
  const db = await getDb();
  const id = c.req.param("id");
  const existing = await db.vettingInvite.findUnique({ where: { id }, include: { documents: true } });
  if (!existing || existing.contractorId !== c.get("contractorId")) {
    return c.json({ error: "Invite not found" }, 404);
  }
  if (existing.status === "CONVERTED") {
    return c.json({ error: "This candidate has already been added to the roster" }, 409);
  }
  if (existing.status !== "SUBMITTED") {
    return c.json({ error: "This candidate hasn't submitted their vetting details yet" }, 409);
  }

  const officer = await db.officer.create({
    data: {
      contractorId: c.get("contractorId")!,
      firstName: existing.firstName,
      lastName: existing.lastName,
      email: existing.email,
      phone: existing.phone,
      // Right to work, if this invite's vetting workflow asked for it — same
      // "answers land in the file the moment the check completes" idea EBC
      // Global describes, just carried over from the candidate's own answer
      // rather than a third-party verification (Vetro doesn't perform RTW
      // checks itself either — see rightToWorkConfirmed elsewhere).
      ...(existing.requiresRightToWork
        ? {
            rightToWorkConfirmed: existing.rightToWorkConfirmed,
            rightToWorkCheckedAt: new Date(),
            rightToWorkDocumentType: existing.rightToWorkDocumentType,
            rightToWorkExpiryDate: existing.rightToWorkExpiryDate,
          }
        : {}),
    },
  });

  await db.vettingSubmission.create({
    data: {
      officerId: officer.id,
      addressHistory: existing.addressHistory ?? [],
      employmentHistory: existing.employmentHistory ?? [],
      references: existing.references ?? [],
      consentGiven: existing.consentGiven,
    },
  });

  if (existing.requiresDbs && existing.dbsCertificateNumber && existing.dbsLevel && existing.dbsIssueDate) {
    await db.dbsCheck.create({
      data: {
        officerId: officer.id,
        level: existing.dbsLevel,
        certificateNumber: existing.dbsCertificateNumber,
        issueDate: existing.dbsIssueDate,
        status: deriveStatus(null),
        lastCheckedAt: new Date(),
      },
    });
  }

  // The files themselves stay where they were uploaded (same bucket, same
  // s3Key) — only the row moves, from VettingInviteDocument onto the new
  // Officer's own Document list, so they show up on OfficerDetail exactly
  // like a document uploaded there directly would.
  if (existing.documents.length > 0) {
    await db.document.createMany({
      data: existing.documents.map((doc) => ({ officerId: officer.id, kind: doc.kind, s3Key: doc.s3Key })),
    });
  }

  const updated = await db.vettingInvite.update({
    where: { id },
    data: { status: "CONVERTED", convertedOfficerId: officer.id },
  });

  await recordAudit({
    contractorId: c.get("contractorId"),
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "vetting_invite.converted",
    entityType: "Officer",
    entityId: officer.id,
  });

  return c.json({ invite: updated, officer });
});
