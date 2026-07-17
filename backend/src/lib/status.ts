import type { ComplianceStatus } from "@prisma/client";

const EXPIRING_WINDOW_DAYS = 30;

/** Mirrors the amber threshold in docs/BRAND_GUIDELINES.md ("Expiring soon (30 days)"). */
export function deriveStatus(expiryDate: Date | null, now = new Date()): ComplianceStatus {
  if (!expiryDate) return "ACTIVE";
  const daysRemaining = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (daysRemaining < 0) return "EXPIRED";
  if (daysRemaining <= EXPIRING_WINDOW_DAYS) return "EXPIRING";
  return "ACTIVE";
}
