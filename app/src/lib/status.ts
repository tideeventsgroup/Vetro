import type { ComplianceStatus, DbsCheck, Officer, VettingRecord } from "./api.js";

const PRIORITY: Record<ComplianceStatus, number> = { EXPIRED: 0, EXPIRING: 1, ACTIVE: 2 };

function worstOf(statuses: ComplianceStatus[]): ComplianceStatus | undefined {
  if (statuses.length === 0) return undefined;
  return statuses.reduce((worst, s) => (PRIORITY[s] < PRIORITY[worst] ? s : worst));
}

/** The one badge a roster row shows: the worst status across everything held. */
export function worstStatus(officer: Officer): ComplianceStatus {
  return (
    worstOf([
      ...officer.licences.map((l) => l.status),
      ...officer.vettingRecords.map((v) => v.status),
      ...officer.dbsChecks.map((d) => d.status),
    ]) ?? "ACTIVE"
  );
}

/** The vetting record (BS7858 etc.) driving the worst vetting status, if any — used to show its expiry alongside the badge. */
export function worstVettingRecord(records: VettingRecord[]): VettingRecord | undefined {
  const worst = worstOf(records.map((r) => r.status));
  if (!worst) return undefined;
  return records.find((r) => r.status === worst);
}

/** The DBS check driving the worst DBS status, if any — mirrors worstVettingRecord. */
export function worstDbsCheck(checks: DbsCheck[]): DbsCheck | undefined {
  const worst = worstOf(checks.map((d) => d.status));
  if (!worst) return undefined;
  return checks.find((d) => d.status === worst);
}
