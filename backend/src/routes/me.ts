import type { Prisma } from "@prisma/client";
import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { getDb } from "../db/client.js";
import { recordAudit } from "../lib/audit.js";
import { createDownloadUrl, createUploadUrl } from "../lib/documents.js";
import type { AppEnv } from "../lib/hono-env.js";

// The officer self-service portal: an officer's own login, scoped to their
// own Officer record via the custom:officer_id claim (see requireOfficerSelf
// in lib/auth.ts) — never to a contractorId or an :id route param, so there
// is no request shape that lets one officer reach another's data.
export const me = new Hono<AppEnv>();

const INCIDENT_CATEGORIES = [
  "THEFT",
  "VANDALISM",
  "TRESPASSING",
  "MEDICAL",
  "FIRE_SAFETY",
  "EQUIPMENT_FAULT",
  "SUSPICIOUS_ACTIVITY",
  "OTHER",
] as const;

// There's no separate "site assignment" concept in the schema (see Shift) —
// having ever had a shift at a site is what establishes an officer belongs
// there, and is what gates every site-scoped self-service action below
// (incidents, checkpoints, visitor log) so an officer can't act at a site
// they've never actually worked.
async function officerBelongsAtSite(
  db: Awaited<ReturnType<typeof getDb>>,
  officerId: string,
  siteId: string
): Promise<boolean> {
  const shift = await db.shift.findFirst({ where: { officerId, siteId } });
  return Boolean(shift);
}

// "Completed" means an admin has approved at least one VettingRecord for
// this officer (see routes/vettingSubmissions.ts) — not merely having
// submitted, and not un-done by a later expiry (that's what the
// ACTIVE/EXPIRING/EXPIRED status badges already communicate, a separate
// concern from having been vetted at all). Gates every operational feature
// below (shifts, incidents, patrols, visitor log) — an unvetted officer has
// no business checking rotas or filing site records yet. Deliberately does
// NOT gate /officer, /vetting-submissions, or /documents, since those are
// exactly what an officer needs to actually get vetted.
const requireVettingCompleted: MiddlewareHandler<AppEnv> = async (c, next) => {
  const db = await getDb();
  const count = await db.vettingRecord.count({ where: { officerId: c.get("officerId")! } });
  if (count === 0) {
    return c.json({ error: "Complete vetting before accessing this feature" }, 403);
  }
  await next();
};

for (const prefix of ["/shifts", "/incidents", "/checkpoints", "/visitor-log", "/sites"]) {
  me.use(prefix, requireVettingCompleted);
  me.use(`${prefix}/*`, requireVettingCompleted);
}

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

// Actual worked time vs the scheduled startTime/endTime — the baseline of
// any time & attendance feature. Deliberately not required before COMPLETED
// can be set: the client's own confirmation (client.ts) is the record of
// record for whether a shift happened at all, clock times are additional
// detail on top of that, not a gate in front of it.
me.patch("/shifts/:id/clock-in", async (c) => {
  const db = await getDb();
  const id = c.req.param("id");
  const officerId = c.get("officerId")!;
  const existing = await db.shift.findUnique({ where: { id } });
  if (!existing || existing.officerId !== officerId) return c.json({ error: "Shift not found" }, 404);
  if (existing.clockInAt) return c.json({ error: "Already clocked in" }, 400);

  const updated = await db.shift.update({
    where: { id },
    data: { clockInAt: new Date() },
    include: { site: true },
  });

  await recordAudit({
    contractorId: existing.contractorId,
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "shift.clocked_in",
    entityType: "Shift",
    entityId: id,
  });

  return c.json(updated);
});

me.patch("/shifts/:id/clock-out", async (c) => {
  const db = await getDb();
  const id = c.req.param("id");
  const officerId = c.get("officerId")!;
  const existing = await db.shift.findUnique({ where: { id } });
  if (!existing || existing.officerId !== officerId) return c.json({ error: "Shift not found" }, 404);
  if (!existing.clockInAt) return c.json({ error: "Clock in before clocking out" }, 400);
  if (existing.clockOutAt) return c.json({ error: "Already clocked out" }, 400);

  const updated = await db.shift.update({
    where: { id },
    data: { clockOutAt: new Date() },
    include: { site: true },
  });

  await recordAudit({
    contractorId: existing.contractorId,
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "shift.clocked_out",
    entityType: "Shift",
    entityId: id,
  });

  return c.json(updated);
});

// The sites this officer has ever had a shift at — used to populate
// site-pickers for incidents/visitor log/checkpoints without exposing the
// contractor's full site list to an OFFICER login.
me.get("/sites", async (c) => {
  const db = await getDb();
  const officerId = c.get("officerId")!;
  const shifts = await db.shift.findMany({
    where: { officerId },
    distinct: ["siteId"],
    include: { site: true },
  });
  return c.json(shifts.map((s) => s.site));
});

// Filed by whichever officer was on-site — Vetro's own compliance record
// plus a filed incident is more evidence for an ACS inspection than the
// compliance record alone.
me.get("/incidents", async (c) => {
  const db = await getDb();
  const rows = await db.incident.findMany({
    where: { officerId: c.get("officerId")! },
    include: { site: true },
    orderBy: { occurredAt: "desc" },
  });
  return c.json(rows);
});

me.post("/incidents/upload-url", async (c) => {
  const officerId = c.get("officerId")!;
  const body = await c.req.json<{ fileName: string; contentType: string }>();
  const { uploadUrl, s3Key } = await createUploadUrl({
    prefix: `incidents/${officerId}`,
    fileName: body.fileName,
    contentType: body.contentType,
  });
  return c.json({ uploadUrl, s3Key });
});

me.post("/incidents", async (c) => {
  const db = await getDb();
  const officerId = c.get("officerId")!;
  const contractorId = c.get("contractorId")!;
  const body = await c.req.json<{
    siteId: string;
    category: string;
    description: string;
    occurredAt: string;
    photoKeys?: string[];
  }>();

  if (!body.siteId || !body.category || !body.description || !body.occurredAt) {
    return c.json({ error: "siteId, category, description and occurredAt are required" }, 400);
  }
  if (!INCIDENT_CATEGORIES.includes(body.category as (typeof INCIDENT_CATEGORIES)[number])) {
    return c.json({ error: `category must be one of: ${INCIDENT_CATEGORIES.join(", ")}` }, 400);
  }
  if (!(await officerBelongsAtSite(db, officerId, body.siteId))) {
    return c.json({ error: "Site not found" }, 404);
  }

  const created = await db.incident.create({
    data: {
      contractorId,
      siteId: body.siteId,
      officerId,
      category: body.category as (typeof INCIDENT_CATEGORIES)[number],
      description: body.description,
      occurredAt: new Date(body.occurredAt),
      photoKeys: body.photoKeys ?? [],
    },
    include: { site: true },
  });

  await recordAudit({
    contractorId,
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "incident.created",
    entityType: "Incident",
    entityId: created.id,
  });

  return c.json(created, 201);
});

me.get("/incidents/:id/photo-url", async (c) => {
  const db = await getDb();
  const officerId = c.get("officerId")!;
  const id = c.req.param("id");
  const key = c.req.query("key");
  if (!key) return c.json({ error: "key is required" }, 400);

  const incident = await db.incident.findUnique({ where: { id } });
  if (!incident || incident.officerId !== officerId || !incident.photoKeys.includes(key)) {
    return c.json({ error: "Photo not found" }, 404);
  }
  const downloadUrl = await createDownloadUrl(key);
  return c.json({ downloadUrl });
});

// A patrol route is just a named set of checkpoints an admin defines per
// site (routes/checkpoints.ts); an officer taps "Scan" from their phone on
// reaching each one — no NFC/GPS hardware assumed. "today's scans" lets the
// UI show a live checklist instead of the whole scan history at once.
me.get("/checkpoints", async (c) => {
  const db = await getDb();
  const officerId = c.get("officerId")!;
  const siteId = c.req.query("siteId");
  if (!siteId) return c.json({ error: "siteId is required" }, 400);
  if (!(await officerBelongsAtSite(db, officerId, siteId))) {
    return c.json({ error: "Site not found" }, 404);
  }

  const checkpoints = await db.checkpoint.findMany({
    where: { siteId },
    orderBy: { createdAt: "asc" },
  });

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const scans = await db.checkpointScan.findMany({
    where: {
      officerId,
      checkpointId: { in: checkpoints.map((cp) => cp.id) },
      scannedAt: { gte: startOfDay },
    },
    orderBy: { scannedAt: "desc" },
  });

  return c.json({ checkpoints, scans });
});

me.post("/checkpoints/:id/scan", async (c) => {
  const db = await getDb();
  const officerId = c.get("officerId")!;
  const checkpointId = c.req.param("id");
  const checkpoint = await db.checkpoint.findUnique({ where: { id: checkpointId } });
  if (!checkpoint || !(await officerBelongsAtSite(db, officerId, checkpoint.siteId))) {
    return c.json({ error: "Checkpoint not found" }, 404);
  }

  const created = await db.checkpointScan.create({
    data: { contractorId: checkpoint.contractorId, checkpointId, officerId },
  });

  await recordAudit({
    contractorId: checkpoint.contractorId,
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "checkpoint.scanned",
    entityType: "CheckpointScan",
    entityId: created.id,
  });

  return c.json(created, 201);
});

// A site-level sign-in/out register. Listing is scoped to the site, not the
// caller — whoever's on duty needs to see everyone currently signed in,
// including visitors an earlier shift's officer signed in, so they can be
// signed out by whoever's actually there when it happens.
me.get("/visitor-log", async (c) => {
  const db = await getDb();
  const officerId = c.get("officerId")!;
  const siteId = c.req.query("siteId");
  if (!siteId) return c.json({ error: "siteId is required" }, 400);
  if (!(await officerBelongsAtSite(db, officerId, siteId))) {
    return c.json({ error: "Site not found" }, 404);
  }

  const rows = await db.visitorLogEntry.findMany({
    where: { siteId },
    orderBy: { signedInAt: "desc" },
    take: 50,
  });
  return c.json(rows);
});

me.post("/visitor-log", async (c) => {
  const db = await getDb();
  const officerId = c.get("officerId")!;
  const contractorId = c.get("contractorId")!;
  const body = await c.req.json<{
    siteId: string;
    visitorName: string;
    company?: string;
    purpose?: string;
    hostName?: string;
  }>();

  if (!body.siteId || !body.visitorName?.trim()) {
    return c.json({ error: "siteId and visitorName are required" }, 400);
  }
  if (!(await officerBelongsAtSite(db, officerId, body.siteId))) {
    return c.json({ error: "Site not found" }, 404);
  }

  const created = await db.visitorLogEntry.create({
    data: {
      contractorId,
      siteId: body.siteId,
      officerId,
      visitorName: body.visitorName,
      company: body.company,
      purpose: body.purpose,
      hostName: body.hostName,
    },
  });

  await recordAudit({
    contractorId,
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "visitor_log.signed_in",
    entityType: "VisitorLogEntry",
    entityId: created.id,
  });

  return c.json(created, 201);
});

me.patch("/visitor-log/:id/sign-out", async (c) => {
  const db = await getDb();
  const officerId = c.get("officerId")!;
  const id = c.req.param("id");
  const existing = await db.visitorLogEntry.findUnique({ where: { id } });
  if (!existing || !(await officerBelongsAtSite(db, officerId, existing.siteId))) {
    return c.json({ error: "Entry not found" }, 404);
  }
  if (existing.signedOutAt) return c.json({ error: "Already signed out" }, 400);

  const updated = await db.visitorLogEntry.update({
    where: { id },
    data: { signedOutAt: new Date() },
  });

  await recordAudit({
    contractorId: existing.contractorId,
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "visitor_log.signed_out",
    entityType: "VisitorLogEntry",
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
    prefix: `officers/${officerId}`,
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
