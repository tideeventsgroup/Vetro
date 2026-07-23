import type { ScheduledHandler } from "aws-lambda";
import { getDb } from "../db/client.js";
import { recordAudit } from "../lib/audit.js";

const RETENTION_FLAG_ACTION = "candidate.retention_flagged";

// Fired daily by the EventBridge rule in infra/lib/schedule-stack.ts.
// Two independent jobs in one run:
//
// 1. Expiry sweep: a VERIFIED check whose expiryDate has passed flips to
//    EXPIRED, so the dashboard's colour coding (lib/status.ts) goes red
//    without anyone having to notice manually. NOT_STARTED/PENDING/REJECTED
//    checks are untouched — expiry only means anything for something that
//    was actually verified.
//
// 2. Retention sweep: each Organisation sets its own retentionDays
//    (routes/organisations.ts). A candidate older than that gets flagged via
//    an audit log entry rather than an automatic delete — GDPR requires the
//    data not be kept indefinitely, not that it vanish silently with no
//    human in the loop. An admin sees the flag on the audit log and acts via
//    the existing candidate-delete/data-request flow. Flagged only once per
//    candidate, not re-logged every day it stays overdue.
export const handler: ScheduledHandler = async () => {
  const db = await getDb();
  const now = new Date();

  const expiredChecks = await db.check.findMany({
    where: { status: "VERIFIED", expiryDate: { lt: now } },
  });
  for (const check of expiredChecks) {
    await db.check.update({ where: { id: check.id }, data: { status: "EXPIRED" } });
    await recordAudit({
      actorEmail: "system@lunarascreening.co.uk",
      action: "check.expired",
      entityType: "Check",
      entityId: check.id,
      metadata: { checkType: check.checkType },
    });
  }

  const organisations = await db.organisation.findMany();
  let flaggedCount = 0;
  for (const organisation of organisations) {
    const cutoff = new Date(now.getTime() - organisation.retentionDays * 24 * 60 * 60 * 1000);
    const overdueCandidates = await db.candidate.findMany({
      where: { organisationId: organisation.id, createdAt: { lt: cutoff } },
    });
    for (const candidate of overdueCandidates) {
      const alreadyFlagged = await db.auditLogEntry.findFirst({
        where: { entityType: "Candidate", entityId: candidate.id, action: RETENTION_FLAG_ACTION },
      });
      if (alreadyFlagged) continue;
      await recordAudit({
        organisationId: organisation.id,
        actorEmail: "system@lunarascreening.co.uk",
        action: RETENTION_FLAG_ACTION,
        entityType: "Candidate",
        entityId: candidate.id,
        metadata: { retentionDays: organisation.retentionDays },
      });
      flaggedCount += 1;
    }
  }

  console.log(`Expiry check complete: ${expiredChecks.length} checks expired, ${flaggedCount} candidates flagged for retention review.`);
};
