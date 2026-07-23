import type { DbsLevel, Prisma } from "@prisma/client";
import { Hono } from "hono";
import { getDb } from "../db/client.js";
import { recordAudit } from "../lib/audit.js";
import type { AppEnv } from "../lib/hono-env.js";

// The candidate-facing half of "send a link before they're added to the
// shift system" (see VettingInvite in prisma/schema.prisma and the admin
// side in routes/vettingInvites.ts). Deliberately no requireAuth/
// requireContractor here, same reasoning as routes/kiosk.ts: a candidate
// has no Cognito account yet — the token itself, not a session, is what
// authorises this. Mounted directly on the outer app in app.ts, before
// requireAuth, under a path that can't collide with the admin-only
// /vetting-invites prefix.
export const vettingInvitePublic = new Hono<AppEnv>();

vettingInvitePublic.get("/candidate-vetting/:token", async (c) => {
  const db = await getDb();
  const invite = await db.vettingInvite.findUnique({
    where: { token: c.req.param("token") },
    include: { contractor: { select: { name: true } } },
  });
  if (!invite) return c.json({ error: "This link is invalid or has expired" }, 404);
  if (invite.status === "CONVERTED") {
    return c.json({ error: "This link has already been used" }, 410);
  }

  return c.json({
    firstName: invite.firstName,
    lastName: invite.lastName,
    organisationName: invite.contractor.name,
    status: invite.status,
    requiresDbs: invite.requiresDbs,
    requiresRightToWork: invite.requiresRightToWork,
  });
});

vettingInvitePublic.post("/candidate-vetting/:token/submit", async (c) => {
  const db = await getDb();
  const invite = await db.vettingInvite.findUnique({ where: { token: c.req.param("token") } });
  if (!invite) return c.json({ error: "This link is invalid or has expired" }, 404);
  if (invite.status === "CONVERTED") {
    return c.json({ error: "This link has already been used" }, 410);
  }

  const body = await c.req.json<{
    addressHistory: Prisma.InputJsonValue;
    employmentHistory: Prisma.InputJsonValue;
    references: Prisma.InputJsonValue;
    consentGiven: boolean;
    dbsLevel?: DbsLevel;
    dbsCertificateNumber?: string;
    dbsIssueDate?: string;
    rightToWorkConfirmed?: boolean;
    rightToWorkDocumentType?: string;
    rightToWorkExpiryDate?: string;
  }>();

  if (!body.consentGiven) {
    return c.json({ error: "consentGiven must be true to submit" }, 400);
  }

  const updated = await db.vettingInvite.update({
    where: { id: invite.id },
    data: {
      addressHistory: body.addressHistory,
      employmentHistory: body.employmentHistory,
      references: body.references,
      consentGiven: body.consentGiven,
      status: "SUBMITTED",
      submittedAt: new Date(),
      ...(invite.requiresDbs
        ? {
            dbsLevel: body.dbsLevel,
            dbsCertificateNumber: body.dbsCertificateNumber,
            dbsIssueDate: body.dbsIssueDate ? new Date(body.dbsIssueDate) : undefined,
          }
        : {}),
      ...(invite.requiresRightToWork
        ? {
            rightToWorkConfirmed: body.rightToWorkConfirmed ?? false,
            rightToWorkDocumentType: body.rightToWorkDocumentType,
            rightToWorkExpiryDate: body.rightToWorkExpiryDate ? new Date(body.rightToWorkExpiryDate) : undefined,
          }
        : {}),
    },
  });

  await recordAudit({
    contractorId: invite.contractorId,
    actorEmail: invite.email,
    action: "vetting_invite.submitted",
    entityType: "VettingInvite",
    entityId: invite.id,
  });

  return c.json({ status: updated.status });
});
