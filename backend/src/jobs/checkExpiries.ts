import type { ScheduledHandler } from "aws-lambda";
import { getDb } from "../db/client.js";
import { deriveStatus } from "../lib/status.js";

// Fired daily by the EventBridge rule in infra/lib/schedule-stack.ts. This is
// the "checked automatically, not chased manually" job — it recomputes
// status from stored expiry dates. It does not itself query the public SIA
// register; that lookup is a separate integration point (see README) and
// plugs in here once built, ahead of the status recompute below.
export const handler: ScheduledHandler = async () => {
  const db = await getDb();
  const now = new Date();

  const licences = await db.siaLicence.findMany();
  for (const licence of licences) {
    const status = deriveStatus(licence.expiryDate, now);
    if (status !== licence.status) {
      await db.siaLicence.update({
        where: { id: licence.id },
        data: { status, lastCheckedAt: now },
      });
    }
  }

  const vettingRecords = await db.vettingRecord.findMany();
  for (const record of vettingRecords) {
    const status = deriveStatus(record.expiryDate, now);
    if (status !== record.status) {
      await db.vettingRecord.update({
        where: { id: record.id },
        data: { status },
      });
    }
  }

  const dbsChecks = await db.dbsCheck.findMany();
  for (const check of dbsChecks) {
    const status = deriveStatus(check.expiryDate, now);
    if (status !== check.status) {
      await db.dbsCheck.update({
        where: { id: check.id },
        data: { status },
      });
    }
  }

  console.log(
    `Expiry check complete: ${licences.length} licences, ${vettingRecords.length} vetting records, ${dbsChecks.length} DBS checks reviewed.`
  );
};
