import type { ScheduledHandler } from "aws-lambda";
import { getDb } from "../db/client.js";
import { CHECK_CALL_GRACE_MS, CHECK_CALL_INTERVAL_MS, shiftRequiresCheckCalls } from "../lib/checkCalls.js";

// Fired every 5 minutes by the EventBridge rule in
// infra/lib/schedule-stack.ts. Nightshifts and weekend day shifts
// (lib/checkCalls.ts) need an hourly welfare check-in; once one runs more
// than 30 minutes overdue this raises the same kind of emergency alert as
// the officer's own SOS button — a lone worker who's gone quiet is exactly
// what this whole feature exists to catch. Cleared automatically the moment
// the officer's next check-in lands (routes/me.ts's POST /check-call).
export const handler: ScheduledHandler = async () => {
  const db = await getDb();
  const now = Date.now();

  const activeShifts = await db.shift.findMany({
    where: { officerId: { not: null }, clockInAt: { not: null }, clockOutAt: null },
    include: {
      alerts: { where: { type: "CHECK_CALL" }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  let escalated = 0;
  for (const shift of activeShifts) {
    if (!shiftRequiresCheckCalls(shift.startTime)) continue;

    const baseline = shift.alerts[0]?.createdAt ?? shift.clockInAt!;
    const overdueBy = now - baseline.getTime() - CHECK_CALL_INTERVAL_MS;
    if (overdueBy < CHECK_CALL_GRACE_MS) continue;

    // Already escalated for this shift and still open — don't spam a new
    // alert every 5-minute sweep while waiting on the same missed check-in.
    const alreadyOpen = await db.alert.findFirst({
      where: { shiftId: shift.id, type: "MISSED_CHECK_CALL", status: { not: "RESOLVED" } },
    });
    if (alreadyOpen) continue;

    await db.alert.create({
      data: {
        contractorId: shift.contractorId,
        officerId: shift.officerId!,
        type: "MISSED_CHECK_CALL",
        shiftId: shift.id,
        latitude: shift.lastLat ?? shift.clockInLat ?? null,
        longitude: shift.lastLng ?? shift.clockInLng ?? null,
      },
    });
    escalated++;
  }

  console.log(`Check-call sweep complete: ${escalated} missed check-in(s) escalated.`);
};
