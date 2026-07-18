import { Hono } from "hono";
import { getDb } from "../db/client.js";
import type { AppEnv } from "../lib/hono-env.js";

export const reports = new Hono<AppEnv>();

// Per-site rollup — shift completion (scheduled/confirmed/completed/missed/
// late) and a headcount of officers scheduled there whose SIA licence or
// BS7858 vetting isn't ACTIVE. Optional ?from=/?to= (ISO dates) scopes the
// shift counts to a period; officer compliance is always current, not
// backdated to that period.
reports.get("/reports/sites", async (c) => {
  const db = await getDb();
  const contractorId = c.get("contractorId");
  const from = c.req.query("from");
  const to = c.req.query("to");
  const dateFilter =
    from || to
      ? { startTime: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
      : {};

  const siteRows = await db.site.findMany({
    where: { contractorId },
    include: {
      shifts: {
        where: dateFilter,
        include: { officer: { include: { licences: true, vettingRecords: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  const rows = siteRows.map((site) => {
    const shiftCounts = { SCHEDULED: 0, CONFIRMED: 0, COMPLETED: 0, MISSED: 0, LATE: 0 };
    const officers = new Map<string, boolean>();

    for (const shift of site.shifts) {
      shiftCounts[shift.status]++;
      if (shift.officer) {
        const atRisk =
          shift.officer.licences.some((l) => l.status !== "ACTIVE") ||
          shift.officer.vettingRecords.some((v) => v.status !== "ACTIVE");
        officers.set(shift.officer.id, atRisk);
      }
    }

    return {
      id: site.id,
      name: site.name,
      shiftCounts,
      officerCount: officers.size,
      officersAtRisk: Array.from(officers.values()).filter(Boolean).length,
    };
  });

  return c.json(rows);
});
