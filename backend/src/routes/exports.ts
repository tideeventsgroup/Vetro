import { Hono } from "hono";
import { getDb } from "../db/client.js";
import type { AppEnv } from "../lib/hono-env.js";

export const exports_ = new Hono<AppEnv>();

function toCsvRow(values: (string | number | null | undefined)[]): string {
  return values.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",");
}

// What an ACS inspector or client due-diligence request actually asks for:
// one row per officer per credential, current status.
exports_.get("/officers.csv", async (c) => {
  const db = await getDb();
  const officerRows = await db.officer.findMany({
    where: { contractorId: c.get("contractorId") },
    include: { licences: true, vettingRecords: true },
    orderBy: { lastName: "asc" },
  });

  const header = toCsvRow([
    "Officer",
    "Credential type",
    "Reference",
    "Status",
    "Expiry date",
  ]);

  const lines = [header];
  for (const officer of officerRows) {
    const name = `${officer.firstName} ${officer.lastName}`;
    for (const licence of officer.licences) {
      lines.push(
        toCsvRow([name, `SIA — ${licence.sector}`, licence.licenceNumber, licence.status, licence.expiryDate.toISOString().slice(0, 10)])
      );
    }
    for (const record of officer.vettingRecords) {
      lines.push(
        toCsvRow([name, record.standard, "", record.status, record.expiryDate?.toISOString().slice(0, 10) ?? ""])
      );
    }
  }

  c.header("Content-Type", "text/csv");
  c.header("Content-Disposition", "attachment; filename=vetro-compliance-export.csv");
  return c.body(lines.join("\n"));
});
