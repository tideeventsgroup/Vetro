import { Hono } from "hono";
import { getDb } from "../db/client.js";

export const dashboard = new Hono();

dashboard.get("/summary", async (c) => {
  const db = await getDb();
  const contractorId = c.req.query("contractorId");
  const where = contractorId ? { officer: { contractorId } } : {};

  const [licenceCounts, vettingCounts] = await Promise.all([
    db.siaLicence.groupBy({ by: ["status"], where, _count: true }),
    db.vettingRecord.groupBy({ by: ["status"], where, _count: true }),
  ]);

  const toCounts = (rows: { status: string; _count: number }[]) =>
    Object.fromEntries(rows.map((r) => [r.status, r._count]));

  return c.json({
    licences: toCounts(licenceCounts),
    vetting: toCounts(vettingCounts),
  });
});
