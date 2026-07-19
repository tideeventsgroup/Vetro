import type { Officer } from "../lib/api.js";
import { worstStatus, worstVettingRecord } from "../lib/status.js";

export function formatCompactDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" });
}

// Vetting-record status badge, mirroring StatusBadge but with the expiry
// date folded into the label (compliance dashboard convention) instead of
// shown as separate meta text.
export function VettingBadge({ officer }: { officer: Officer }) {
  const worst = worstVettingRecord(officer.vettingRecords);
  if (worst) {
    const label = worst.status === "ACTIVE" ? "Active" : worst.status === "EXPIRING" ? "Expiring" : "Expired";
    const cls =
      worst.status === "ACTIVE" ? "status-active" : worst.status === "EXPIRING" ? "status-expiring" : "status-expired";
    return (
      <span className={`status-badge ${cls}`}>
        {label}
        {worst.expiryDate ? ` · exp ${formatCompactDate(worst.expiryDate)}` : ""}
      </span>
    );
  }
  const pending = (officer.vettingSubmissions ?? []).some((s) => s.status === "PENDING_REVIEW");
  if (pending) return <span className="status-badge status-pending">Submitted to provider</span>;
  return <span className="status-badge status-neutral">Not started</span>;
}

// PIN badge — gated by vetting status (an expired vetting record blocks
// kiosk book-on regardless of employment) but also distinguishes officers
// who simply don't have a PIN generated yet (see OfficerDetail.tsx).
export function PinBadge({ officer }: { officer: Officer }) {
  if (!officer.pin) return <span className="status-badge status-neutral">Not issued</span>;
  const status = worstStatus(officer);
  if (status === "EXPIRED") return <span className="status-badge status-expired">Blocked</span>;
  if (status === "EXPIRING") return <span className="status-badge status-expiring">At risk</span>;
  return <span className="status-badge status-active">Active</span>;
}
