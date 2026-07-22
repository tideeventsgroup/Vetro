import type { ComplianceStatus, Officer, VettingRecord } from "./api.js";

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
