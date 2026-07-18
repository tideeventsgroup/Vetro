import type { ComplianceStatus, ShiftStatus, SubmissionStatus } from "../lib/api.js";

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

const SUBMISSION_LABELS: Record<SubmissionStatus, string> = {
  PENDING_REVIEW: "Pending review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

const SUBMISSION_CLASSES: Record<SubmissionStatus, string> = {
  PENDING_REVIEW: "status-expiring",
  APPROVED: "status-active",
  REJECTED: "status-expired",
};

export function SubmissionStatusBadge({ status }: { status: SubmissionStatus }) {
  return <span className={`status-badge ${SUBMISSION_CLASSES[status]}`}>{SUBMISSION_LABELS[status]}</span>;
}

const SHIFT_LABELS: Record<ShiftStatus, string> = {
  SCHEDULED: "Scheduled",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  MISSED: "Missed",
  LATE: "Late",
};

const SHIFT_CLASSES: Record<ShiftStatus, string> = {
  SCHEDULED: "status-neutral",
  CONFIRMED: "status-confirmed",
  COMPLETED: "status-active",
  MISSED: "status-expired",
  LATE: "status-expiring",
};

export function ShiftStatusBadge({ status }: { status: ShiftStatus }) {
  return <span className={`status-badge ${SHIFT_CLASSES[status]}`}>{SHIFT_LABELS[status]}</span>;
}
