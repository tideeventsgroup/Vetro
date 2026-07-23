import type { Candidate, Check, CheckType } from "./api.js";

const EXPIRING_SOON_DAYS = 30;

export type DashboardColour = "green" | "amber" | "red";

export function isExpiringSoon(expiryDate: string | null): boolean {
  if (!expiryDate) return false;
  const days = (new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return days >= 0 && days <= EXPIRING_SOON_DAYS;
}

/**
 * The one colour a candidate row shows on the dashboard — mirrors
 * backend/src/lib/status.ts's worstCheckColour exactly, since the badge here
 * has to agree with the review queue's own idea of "still outstanding."
 * Red beats amber beats green: any check missing/expired/rejected makes the
 * whole row red regardless of how many others are fine.
 */
export function worstCheckColour(candidate: Pick<Candidate, "checks">): DashboardColour {
  const checks = candidate.checks;
  if (checks.some((c) => c.status === "NOT_STARTED" || c.status === "EXPIRED" || c.status === "REJECTED")) {
    return "red";
  }
  if (checks.some((c) => c.status === "PENDING" || (c.status === "VERIFIED" && isExpiringSoon(c.expiryDate)))) {
    return "amber";
  }
  return "green";
}

export const CHECK_TYPE_LABELS: Record<CheckType, string> = {
  SIA_LICENCE: "SIA licence",
  FIRST_AID: "First aid certificate",
  RIGHT_TO_WORK: "Right to work",
  ID_DOCUMENT: "ID document",
  TRAINING: "Training / competency",
};

export function checkTypeLabel(checkType: CheckType): string {
  return CHECK_TYPE_LABELS[checkType];
}

export function worstCheck(checks: Check[]): Check | undefined {
  const priority: Record<Check["status"], number> = {
    NOT_STARTED: 0,
    REJECTED: 0,
    EXPIRED: 0,
    PENDING: 1,
    VERIFIED: 2,
  };
  if (checks.length === 0) return undefined;
  return checks.reduce((worst, c) => (priority[c.status] < priority[worst.status] ? c : worst));
}
