import type { ScheduledHandler } from "aws-lambda";
import { getDb } from "../db/client.js";

// How late a shift is allowed to run before it's flagged — long enough that
// a few minutes' lateness (LATE, which the client sets themselves once the
// shift has actually happened) doesn't get pre-empted by this job.
const GRACE_PERIOD_MS = 30 * 60 * 1000;

// Fired every 15 minutes by the EventBridge rule in
// infra/lib/schedule-stack.ts. Catches shifts nobody clocked in for and
// nobody's manually actioned — the automated half of "no-show alerts" from
// the workforce-management plan; the other half is the officer's own SOS
// button (routes/me.ts), which this has nothing to do with.
export const handler: ScheduledHandler = async () => {
  const db = await getDb();
  const cutoff = new Date(Date.now() - GRACE_PERIOD_MS);

  // Only SCHEDULED/CONFIRMED shifts match — once flagged below they move to
  // MISSED and fall out of this filter, so a later run can never re-alert
  // the same shift twice.
  const overdue = await db.shift.findMany({
    where: {
      officerId: { not: null },
      clockInAt: null,
      status: { in: ["SCHEDULED", "CONFIRMED"] },
      startTime: { lt: cutoff },
    },
  });

  for (const shift of overdue) {
    await db.shift.update({ where: { id: shift.id }, data: { status: "MISSED" } });
    await db.alert.create({
      data: {
        contractorId: shift.contractorId,
        officerId: shift.officerId!,
        type: "NO_SHOW",
        shiftId: shift.id,
      },
    });
  }

  console.log(`No-show check complete: ${overdue.length} shift(s) flagged.`);
};
