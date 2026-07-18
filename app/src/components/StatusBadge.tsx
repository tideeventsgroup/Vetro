import type { ComplianceStatus } from "../lib/api.js";

const LABELS: Record<ComplianceStatus, string> = {
  ACTIVE: "Active",
  EXPIRING: "Expiring soon",
  EXPIRED: "Expired",
};

const CLASSES: Record<ComplianceStatus, string> = {
  ACTIVE: "status-active",
  EXPIRING: "status-expiring",
  EXPIRED: "status-expired",
};

export function StatusBadge({ status }: { status: ComplianceStatus }) {
  return <span className={`status-badge ${CLASSES[status]}`}>{LABELS[status]}</span>;
}
