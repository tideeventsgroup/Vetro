import { Hono } from "hono";
import { getDb } from "../db/client.js";
import { recordAudit } from "../lib/audit.js";
import { getBookOnBlocker } from "../lib/compliance.js";
import { checkGeofence, type ClockGpsBody } from "../lib/geofence.js";
import type { AppEnv } from "../lib/hono-env.js";

// A shared site device (tablet/phone at reception, not anyone's own login)
// books officers on/off with a PIN + the site's SIN instead of a Cognito
// session — see docs on Officer.pin/Site.sin in prisma/schema.prisma. There
// is deliberately no requireAuth/requireContractor here: the SIN is what
// resolves the tenant, the PIN is what resolves the officer, in that order.
export const kiosk = new Hono<AppEnv>();

const BOOK_ON_WINDOW_MS = 4 * 60 * 60 * 1000;

async function resolveSiteBySin(db: Awaited<ReturnType<typeof getDb>>, sin: string) {
  const site = await db.site.findUnique({ where: { sin } });
  if (!site) return undefined;
  const contractor = await db.contractor.findUniqueOrThrow({ where: { id: site.contractorId } });
  return { site, contractor };
}

kiosk.get("/kiosk/site", async (c) => {
  const sin = c.req.query("sin");
  if (!sin) return c.json({ error: "sin is required" }, 400);

  const db = await getDb();
  const resolved = await resolveSiteBySin(db, sin.toUpperCase());
  if (!resolved) return c.json({ error: "Site not found for this SIN" }, 404);

  return c.json({ siteName: resolved.site.name, organisationName: resolved.contractor.name });
});

kiosk.post("/kiosk/book-on", async (c) => {
  const body = await c.req.json<{ sin?: string; pin?: string } & ClockGpsBody>();
  if (!body.sin || !body.pin) return c.json({ error: "sin and pin are required" }, 400);

  const db = await getDb();
  const resolved = await resolveSiteBySin(db, body.sin.toUpperCase());
  if (!resolved) return c.json({ error: "Site not found for this SIN" }, 404);
  const { site, contractor } = resolved;

  const officer = await db.officer.findFirst({ where: { contractorId: contractor.id, pin: body.pin } });
  if (!officer) return c.json({ error: "Incorrect PIN" }, 400);

  const blocker = await getBookOnBlocker(db, officer.id);
  if (blocker) return c.json({ error: blocker }, 403);

  const now = new Date();
  const shift = await db.shift.findFirst({
    where: {
      officerId: officer.id,
      siteId: site.id,
      clockInAt: null,
      startTime: { gte: new Date(now.getTime() - BOOK_ON_WINDOW_MS), lte: new Date(now.getTime() + BOOK_ON_WINDOW_MS) },
    },
    orderBy: { startTime: "asc" },
  });
  if (!shift) return c.json({ error: "No shift due at this site right now" }, 404);

  const gps: ClockGpsBody = { lat: body.lat, lng: body.lng, accuracyM: body.accuracyM };
  const { distanceM, error } = checkGeofence(site, gps, "book on at this site");
  if (error) return c.json({ error }, 403);

  const updated = await db.shift.update({
    where: { id: shift.id },
    data: {
      clockInAt: now,
      clockInLat: gps.lat ?? null,
      clockInLng: gps.lng ?? null,
      clockInAccuracyM: gps.accuracyM ?? null,
      clockInDistanceM: distanceM,
    },
  });

  await recordAudit({
    contractorId: contractor.id,
    actorEmail: "kiosk",
    action: "shift.clocked_in",
    entityType: "Shift",
    entityId: shift.id,
  });

  return c.json({
    officerName: `${officer.firstName} ${officer.lastName}`,
    siteName: site.name,
    clockInAt: updated.clockInAt,
  });
});

kiosk.post("/kiosk/book-off", async (c) => {
  const body = await c.req.json<{ sin?: string; pin?: string } & ClockGpsBody>();
  if (!body.sin || !body.pin) return c.json({ error: "sin and pin are required" }, 400);

  const db = await getDb();
  const resolved = await resolveSiteBySin(db, body.sin.toUpperCase());
  if (!resolved) return c.json({ error: "Site not found for this SIN" }, 404);
  const { site, contractor } = resolved;

  const officer = await db.officer.findFirst({ where: { contractorId: contractor.id, pin: body.pin } });
  if (!officer) return c.json({ error: "Incorrect PIN" }, 400);

  const shift = await db.shift.findFirst({
    where: { officerId: officer.id, siteId: site.id, clockInAt: { not: null }, clockOutAt: null },
    orderBy: { clockInAt: "desc" },
  });
  if (!shift) return c.json({ error: "You're not currently booked on at this site" }, 404);

  const gps: ClockGpsBody = { lat: body.lat, lng: body.lng, accuracyM: body.accuracyM };
  const { distanceM, error } = checkGeofence(site, gps, "book off at this site");
  if (error) return c.json({ error }, 403);

  const now = new Date();
  const updated = await db.shift.update({
    where: { id: shift.id },
    data: {
      clockOutAt: now,
      clockOutLat: gps.lat ?? null,
      clockOutLng: gps.lng ?? null,
      clockOutAccuracyM: gps.accuracyM ?? null,
      clockOutDistanceM: distanceM,
    },
  });

  await recordAudit({
    contractorId: contractor.id,
    actorEmail: "kiosk",
    action: "shift.clocked_out",
    entityType: "Shift",
    entityId: shift.id,
  });

  return c.json({
    officerName: `${officer.firstName} ${officer.lastName}`,
    siteName: site.name,
    clockOutAt: updated.clockOutAt,
  });
});
