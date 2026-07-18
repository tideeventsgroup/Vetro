import type { ComplianceStatus, Officer } from "./api.js";

const PRIORITY: Record<ComplianceStatus, number> = { EXPIRED: 0, EXPIRING: 1, ACTIVE: 2 };

/** The one badge a roster row shows: the worst status across everything held. */
export function worstStatus(officer: Officer): ComplianceStatus {
  const statuses = [...officer.licences.map((l) => l.status), ...officer.vettingRecords.map((v) => v.status)];
  if (statuses.length === 0) return "ACTIVE";
  return statuses.reduce((worst, s) => (PRIORITY[s] < PRIORITY[worst] ? s : worst));
}
