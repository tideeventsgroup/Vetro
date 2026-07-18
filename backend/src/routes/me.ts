import type { Prisma } from "@prisma/client";
import { Hono } from "hono";
import { getDb } from "../db/client.js";
import { recordAudit } from "../lib/audit.js";
import { createDownloadUrl, createUploadUrl } from "../lib/documents.js";
import type { AppEnv } from "../lib/hono-env.js";

// The officer self-service portal: an officer's own login, scoped to their
// own Officer record via the custom:officer_id claim (see requireOfficerSelf
// in lib/auth.ts) — never to a contractorId or an :id route param, so there
// is no request shape that lets one officer reach another's data.
export const me = new Hono<AppEnv>();

me.get("/officer", async (c) => {
  const db = await getDb();
  const officer = await db.officer.findUnique({
    where: { id: c.get("officerId")! },
    include: { licences: true, vettingRecords: true, qualifications: true, documents: true, vettingSubmissions: true },
  });
  if (!officer) return c.json({ error: "Officer not found" }, 404);
  return c.json(officer);
});

// An officer's own shifts — the same "who's where, when" data Schedule.tsx
// gives an admin, scoped to just the shifts assigned to this officer. Every
// staff-facing security scheduling tool (Rota, When I Work, TimeGate+'s own
// employee app) treats "can I see my next shift" as table stakes.
me.get("/shifts", async (c) => {
  const db = await getDb();
  const rows = await db.shift.findMany({
    where: { officerId: c.get("officerId")! },
    include: { site: true },
    orderBy: { startTime: "asc" },
  });
  return c.json(rows);
});

// Acknowledging an assigned shift — distinct from the client's later
// COMPLETED/MISSED/LATE confirmation (client.ts): this is the officer
// saying "I've seen this and I'm coming", not reporting what happened.
// Only valid from SCHEDULED so it can't be used to relitigate a shift the
// client or admin has already resolved.
me.patch("/shifts/:id/confirm", async (c) => {
  const db = await getDb();
  const id = c.req.param("id");
  const officerId = c.get("officerId")!;
  const existing = await db.shift.findUnique({ where: { id } });
  if (!existing || existing.officerId !== officerId) return c.json({ error: "Shift not found" }, 404);
  if (existing.status !== "SCHEDULED") {
    return c.json({ error: "Only a scheduled shift can be confirmed" }, 400);
  }

  const updated = await db.shift.update({
    where: { id },
    data: { status: "CONFIRMED" },
    include: { site: true },
  });

  await recordAudit({
    contractorId: existing.contractorId,
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "shift.officer_confirmed",
    entityType: "Shift",
    entityId: id,
  });

  return c.json(updated);
});

me.get("/vetting-submissions", async (c) => {
  const db = await getDb();
  const rows = await db.vettingSubmission.findMany({
    where: { officerId: c.get("officerId")! },
    orderBy: { submittedAt: "desc" },
  });
  return c.json(rows);
});

// What the officer submits themselves — Vetro still doesn't perform the
// BS7858 check; this sits as PENDING_REVIEW until an admin reviews it (see
// VettingSubmission in prisma/schema.prisma).
me.post("/vetting-submissions", async (c) => {
  const db = await getDb();
  const officerId = c.get("officerId")!;
  const body = await c.req.json<{
    addressHistory: Prisma.InputJsonValue;
    employmentHistory: Prisma.InputJsonValue;
    references: Prisma.InputJsonValue;
    consentGiven: boolean;
  }>();

  if (!body.consentGiven) {
    return c.json({ error: "consentGiven must be true to submit" }, 400);
  }

  const created = await db.vettingSubmission.create({
    data: {
      officerId,
      addressHistory: body.addressHistory,
      employmentHistory: body.employmentHistory,
      references: body.references,
      consentGiven: body.consentGiven,
    },
  });

  await recordAudit({
    contractorId: c.get("contractorId"),
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "vetting_submission.created",
    entityType: "VettingSubmission",
    entityId: created.id,
  });

  return c.json(created, 201);
});

// Same two-step presigned upload as the admin-facing documents route
// (lib/documents.ts), just scoped to the caller's own officerId instead of a
// contractorId-checked :officerId param.
me.post("/documents/upload-url", async (c) => {
  const officerId = c.get("officerId")!;
  const body = await c.req.json<{ fileName: string; contentType: string }>();
  const { uploadUrl, s3Key } = await createUploadUrl({
    officerId,
    fileName: body.fileName,
    contentType: body.contentType,
  });
  return c.json({ uploadUrl, s3Key });
});

me.post("/documents", async (c) => {
  const db = await getDb();
  const officerId = c.get("officerId")!;
  const body = await c.req.json<{ kind: string; s3Key: string }>();
  const created = await db.document.create({ data: { officerId, kind: body.kind, s3Key: body.s3Key } });

  await recordAudit({
    contractorId: c.get("contractorId"),
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "document.created",
    entityType: "Document",
    entityId: created.id,
  });

  return c.json(created, 201);
});

me.get("/documents/:id/download-url", async (c) => {
  const db = await getDb();
  const document = await db.document.findUnique({ where: { id: c.req.param("id") } });
  if (!document || document.officerId !== c.get("officerId")) {
    return c.json({ error: "Document not found" }, 404);
  }
  const downloadUrl = await createDownloadUrl(document.s3Key);
  return c.json({ downloadUrl });
});
