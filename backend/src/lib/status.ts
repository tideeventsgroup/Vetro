import type { CheckStatus } from "@prisma/client";

const EXPIRING_WINDOW_DAYS = 30;

/**
 * A VERIFIED check with an expiry date inside this window still reads
 * VERIFIED in the database — this computes the dashboard's "expiring soon"
 * amber colour on top of that stored status, rather than it being a status
 * value of its own (CheckStatus only has NOT_STARTED/PENDING/VERIFIED/
 * EXPIRED/REJECTED — see prisma/schema.prisma).
 */
export function isExpiringSoon(status: CheckStatus, expiryDate: Date | null, now = new Date()): boolean {
  if (status !== "VERIFIED" || !expiryDate) return false;
  const daysRemaining = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return daysRemaining >= 0 && daysRemaining <= EXPIRING_WINDOW_DAYS;
}

/** Whether a stored expiry date has now passed — the expiry job (jobs/checkExpiries.ts) uses this to flip a VERIFIED check to EXPIRED automatically. */
export function hasExpired(expiryDate: Date | null, now = new Date()): boolean {
  return Boolean(expiryDate && expiryDate.getTime() < now.getTime());
}

/**
 * The colour a dashboard row should show for one candidate, given every one
 * of their checks — worst case wins. green only when every required check
 * is VERIFIED and none are expiring soon; amber for PENDING/expiring soon;
 * red for NOT_STARTED/EXPIRED/REJECTED.
 */
export function worstCheckColour(
  checks: { status: CheckStatus; expiryDate: Date | null }[]
): "green" | "amber" | "red" {
  if (checks.length === 0) return "red";
  if (checks.some((c) => c.status === "NOT_STARTED" || c.status === "EXPIRED" || c.status === "REJECTED")) {
    return "red";
  }
  if (checks.some((c) => c.status === "PENDING" || isExpiringSoon(c.status, c.expiryDate))) {
    return "amber";
  }
  return "green";
}
