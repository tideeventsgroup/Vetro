import type { Candidate, CheckType } from "./api.js";

const EXPIRING_SOON_DAYS = 30;

export type DashboardColour = "green" | "amber" | "red";
export type OverallCheckState = "verified" | "pending" | "rejected";

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

/**
 * The three-way state the dashboard's filter dropdown and sort-by-overall
 * column use — a coarser view than worstCheckColour's traffic-light (which
 * folds "missing" and "rejected" into the same red), since a filter that
 * separates "still outstanding" from "actively rejected" is more useful
 * than a colour that just needs to catch the eye.
 */
export function overallCheckState(candidate: Pick<Candidate, "checks">): OverallCheckState {
  const checks = candidate.checks;
  if (checks.some((c) => c.status === "REJECTED")) return "rejected";
  if (checks.some((c) => c.status !== "VERIFIED" || isExpiringSoon(c.expiryDate))) return "pending";
  return "verified";
}

export const CHECK_TYPE_LABELS: Record<CheckType, string> = {
  SIA_LICENCE: "SIA licence",
  FIRST_AID: "First aid certificate",
  RIGHT_TO_WORK: "Right to work",
  ID_DOCUMENT: "ID document",
  TRAINING: "Training / competency",
  DBS_CHECK: "DBS check",
};

export function checkTypeLabel(checkType: CheckType): string {
  return CHECK_TYPE_LABELS[checkType];
}

/** Short column headers for the dashboard's fixed-width check-status table. */
export const CHECK_TYPE_SHORT_LABELS: Record<CheckType, string> = {
  SIA_LICENCE: "SIA",
  RIGHT_TO_WORK: "RTW",
  ID_DOCUMENT: "ID",
  FIRST_AID: "First aid",
  TRAINING: "Training",
  DBS_CHECK: "DBS",
};

/**
 * The dashboard table's five fixed columns, left to right — DBS_CHECK is
 * tracked-status-only (see prisma/schema.prisma's CheckType comment): it
 * gets a column here like any other check, just never a document upload
 * path (routes/candidatePublic.ts rejects one). TRAINING has no dedicated
 * column — an org that configures a role with a training requirement still
 * sees it on the candidate detail page and it still counts toward the
 * overall status, it just isn't one of this table's fixed columns.
 */
export const DASHBOARD_CHECK_COLUMNS: CheckType[] = [
  "SIA_LICENCE",
  "RIGHT_TO_WORK",
  "ID_DOCUMENT",
  "FIRST_AID",
  "DBS_CHECK",
];
