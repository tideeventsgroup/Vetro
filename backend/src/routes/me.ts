import type { Checkpoint, Prisma } from "@prisma/client";
import { Hono } from "hono";
import type { Context, MiddlewareHandler } from "hono";
import { getDb } from "../db/client.js";
import { recordAudit } from "../lib/audit.js";
import { createDownloadUrl, createUploadUrl } from "../lib/documents.js";
import { haversineDistanceM } from "../lib/geo.js";
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
interface ClockGpsBody {
  lat?: number;
  lng?: number;
  accuracyM?: number;
}

// A site only enforces its geofence once an admin has actually set
// coordinates + a radius for it — sites without that configured never block
// clock-in on missing GPS, so this stays opt-in per site.
function checkGeofence(
  place: { latitude: number | null; longitude: number | null; geofenceRadiusM: number | null },
  gps: ClockGpsBody,
  action = "clock in/out at this site"
): { distanceM: number | null; error?: string } {
  const geofenced =
    place.latitude !== null && place.longitude !== null && place.geofenceRadiusM !== null;
  if (!geofenced) return { distanceM: null };

  if (gps.lat === undefined || gps.lng === undefined) {
    return { distanceM: null, error: `Location is required to ${action}` };
  }

  const distanceM = haversineDistanceM(place.latitude!, place.longitude!, gps.lat, gps.lng);
  if (distanceM > place.geofenceRadiusM!) {
    return {
      distanceM,
      error: `Too far away to ${action} — you're ${Math.round(distanceM)}m away, must be within ${place.geofenceRadiusM}m`,
    };
  }
  return { distanceM };
}

me.patch("/shifts/:id/clock-in", async (c) => {
  const db = await getDb();
  const id = c.req.param("id");
  const officerId = c.get("officerId")!;
  const existing = await db.shift.findUnique({ where: { id }, include: { site: true } });
  if (!existing || existing.officerId !== officerId) return c.json({ error: "Shift not found" }, 404);
  if (existing.clockInAt) return c.json({ error: "Already clocked in" }, 400);

  const gps = await c.req.json<ClockGpsBody>().catch(() => ({}) as ClockGpsBody);
  const { distanceM, error } = checkGeofence(existing.site, gps);
  if (error) return c.json({ error }, 403);

  const updated = await db.shift.update({
    where: { id },
    data: {
      clockInAt: new Date(),
      clockInLat: gps.lat ?? null,
      clockInLng: gps.lng ?? null,
      clockInAccuracyM: gps.accuracyM ?? null,
      clockInDistanceM: distanceM,
    },
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
  const existing = await db.shift.findUnique({ where: { id }, include: { site: true } });
  if (!existing || existing.officerId !== officerId) return c.json({ error: "Shift not found" }, 404);
  if (!existing.clockInAt) return c.json({ error: "Clock in before clocking out" }, 400);
  if (existing.clockOutAt) return c.json({ error: "Already clocked out" }, 400);

  const gps = await c.req.json<ClockGpsBody>().catch(() => ({}) as ClockGpsBody);
  const { distanceM, error } = checkGeofence(existing.site, gps);
  if (error) return c.json({ error }, 403);

  const updated = await db.shift.update({
    where: { id },
    data: {
      clockOutAt: new Date(),
      clockOutLat: gps.lat ?? null,
      clockOutLng: gps.lng ?? null,
      clockOutAccuracyM: gps.accuracyM ?? null,
      clockOutDistanceM: distanceM,
    },
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

// A periodic "still here, and this is where" update from the officer's own
// device while clocked in — powers the admin Live Ops map's live position,
// distinct from the fixed clockIn/clockOut snapshots. Gated by the same
// requireVettingCompleted as the rest of "/shifts" since only a vetted
// officer can ever have an active (clocked-in) shift to ping from anyway.
// No audit entry: this fires every couple of minutes and is routine
// telemetry, not an action worth an audit trail.
me.patch("/shifts/:id/ping", async (c) => {
  const db = await getDb();
  const id = c.req.param("id");
  const officerId = c.get("officerId")!;
  const existing = await db.shift.findUnique({ where: { id } });
  if (!existing || existing.officerId !== officerId) return c.json({ error: "Shift not found" }, 404);
  if (!existing.clockInAt || existing.clockOutAt) {
    return c.json({ error: "Shift is not currently clocked in" }, 400);
  }

  const gps = await c.req.json<ClockGpsBody>().catch(() => ({}) as ClockGpsBody);
  if (gps.lat === undefined || gps.lng === undefined) {
    return c.json({ error: "lat and lng are required" }, 400);
  }

  const updated = await db.shift.update({
    where: { id },
    data: { lastLat: gps.lat, lastLng: gps.lng, lastLocationAt: new Date() },
  });
  return c.json({ lastLat: updated.lastLat, lastLng: updated.lastLng, lastLocationAt: updated.lastLocationAt });
});

// Lone-worker panic button. Deliberately NOT among the requireVettingCompleted
// prefixes above — a safety escape hatch has no business waiting on admin
// approval of paperwork. GPS is best-effort: an alert with no location fix is
// still far better than no alert at all.
me.post("/sos", async (c) => {
  const db = await getDb();
  const officerId = c.get("officerId")!;
  const contractorId = c.get("contractorId")!;
  const gps = await c.req.json<ClockGpsBody>().catch(() => ({}) as ClockGpsBody);

  const created = await db.alert.create({
    data: {
      contractorId,
      officerId,
      latitude: gps.lat ?? null,
      longitude: gps.lng ?? null,
      accuracyM: gps.accuracyM ?? null,
    },
  });

  await recordAudit({
    contractorId,
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "alert.sos_triggered",
    entityType: "Alert",
    entityId: created.id,
  });

  return c.json(created, 201);
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
    lat?: number;
    lng?: number;
    accuracyM?: number;
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
      latitude: body.lat ?? null,
      longitude: body.lng ?? null,
      accuracyM: body.accuracyM ?? null,
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

// Shared by both scan entry points below (by checkpoint id, and by the
// QR-code token) — looks the checkpoint up by whichever criteria the caller
// scanned, then applies the one authorization rule that matters regardless
// of entry point: the officer must have actually worked a shift at that
// checkpoint's site.
async function findCheckpointForOfficer(
  db: Awaited<ReturnType<typeof getDb>>,
  officerId: string,
  where: { id: string } | { qrCode: string }
): Promise<Checkpoint | null> {
  const checkpoint = await db.checkpoint.findUnique({ where });
  if (!checkpoint || !(await officerBelongsAtSite(db, officerId, checkpoint.siteId))) {
    return null;
  }
  return checkpoint;
}

async function performCheckpointScan(
  c: Context<AppEnv>,
  checkpoint: Checkpoint,
  officerId: string,
  gps: ClockGpsBody
) {
  const db = await getDb();
  const { error } = checkGeofence(checkpoint, gps, "scan this checkpoint");
  if (error) return c.json({ error }, 403);

  const created = await db.checkpointScan.create({
    data: {
      contractorId: checkpoint.contractorId,
      checkpointId: checkpoint.id,
      officerId,
      latitude: gps.lat ?? null,
      longitude: gps.lng ?? null,
      accuracyM: gps.accuracyM ?? null,
    },
  });

  await recordAudit({
    contractorId: checkpoint.contractorId,
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "checkpoint.scanned",
    entityType: "CheckpointScan",
    entityId: created.id,
  });

  return c.json(created, 201);
}

me.post("/checkpoints/:id/scan", async (c) => {
  const db = await getDb();
  const officerId = c.get("officerId")!;
  const checkpoint = await findCheckpointForOfficer(db, officerId, { id: c.req.param("id") });
  if (!checkpoint) return c.json({ error: "Checkpoint not found" }, 404);

  const gps = await c.req.json<ClockGpsBody>().catch(() => ({}) as ClockGpsBody);
  return performCheckpointScan(c, checkpoint, officerId, gps);
});

// The QR-code scan path — an officer taps "Scan checkpoint" and their camera
// reads the code physically posted at that spot, so lookup goes by the
// opaque qrCode token rather than a checkpoint id the officer never sees.
me.post("/checkpoints/scan-qr", async (c) => {
  const db = await getDb();
  const officerId = c.get("officerId")!;
  const body = await c.req
    .json<ClockGpsBody & { qrCode?: string }>()
    .catch(() => ({}) as ClockGpsBody & { qrCode?: string });
  if (!body.qrCode) return c.json({ error: "qrCode is required" }, 400);

  const checkpoint = await findCheckpointForOfficer(db, officerId, { qrCode: body.qrCode });
  if (!checkpoint) return c.json({ error: "Checkpoint not found" }, 404);

  return performCheckpointScan(c, checkpoint, officerId, body);
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

// Dispatch messaging, officer side — read-only here (see routes/messages.ts
// for how admins send). A message is "mine" if it's a direct message to me
// or a contractor-wide broadcast (recipientId null); read state is tracked
// per-officer via MessageRead so a broadcast's unread count is personal to
// each reader, not shared.
//
// The 100-row cap is shared between the list and the count so the two never
// disagree — counting unread against the full, unbounded history would let
// the badge report messages the officer can't actually see or mark read via
// /messages (which only ever shows the newest 100).
const MESSAGE_PAGE_SIZE = 100;

async function getMyMessagesWithReadState(
  db: Awaited<ReturnType<typeof getDb>>,
  contractorId: string,
  officerId: string
) {
  const rows = await db.message.findMany({
    where: { contractorId, OR: [{ recipientId: officerId }, { recipientId: null }] },
    orderBy: { createdAt: "desc" },
    take: MESSAGE_PAGE_SIZE,
  });
  const reads = await db.messageRead.findMany({
    where: { officerId, messageId: { in: rows.map((r) => r.id) } },
    select: { messageId: true },
  });
  const readIds = new Set(reads.map((r) => r.messageId));
  return rows.map((r) => ({ ...r, read: readIds.has(r.id) }));
}

me.get("/messages", async (c) => {
  const db = await getDb();
  const rows = await getMyMessagesWithReadState(db, c.get("contractorId")!, c.get("officerId")!);
  return c.json(rows);
});

me.get("/messages/unread-count", async (c) => {
  const db = await getDb();
  const rows = await getMyMessagesWithReadState(db, c.get("contractorId")!, c.get("officerId")!);
  return c.json({ unreadCount: rows.filter((r) => !r.read).length });
});

// Marks every currently-unread message (within the same 100-row window
// above) as read in one atomic write — there's no per-message read toggle in
// the product, MyMessages.tsx marks everything visible as read on open, so a
// single bulk call replaces what would otherwise be one request per unread
// message. `skipDuplicates` makes this safe under a concurrent duplicate
// call (StrictMode's double effect invocation, two tabs) without needing a
// try/catch around a unique-constraint violation.
me.post("/messages/mark-read", async (c) => {
  const db = await getDb();
  const officerId = c.get("officerId")!;
  const rows = await getMyMessagesWithReadState(db, c.get("contractorId")!, officerId);
  const unreadIds = rows.filter((r) => !r.read).map((r) => r.id);

  if (unreadIds.length > 0) {
    await db.messageRead.createMany({
      data: unreadIds.map((messageId) => ({ messageId, officerId })),
      skipDuplicates: true,
    });
  }

  return c.json({ markedCount: unreadIds.length });
});
