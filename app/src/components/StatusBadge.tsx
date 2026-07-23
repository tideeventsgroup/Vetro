import type { ComplianceStatus, EmploymentStatus, SubmissionStatus, VettingInviteStatus } from "../lib/api.js";

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
  PENDING_REVIEW: "status-pending",
  APPROVED: "status-active",
  REJECTED: "status-expired",
};

export function SubmissionStatusBadge({ status }: { status: SubmissionStatus }) {
  return <span className={`status-badge ${SUBMISSION_CLASSES[status]}`}>{SUBMISSION_LABELS[status]}</span>;
}

const EMPLOYMENT_LABELS: Record<EmploymentStatus, string> = {
  ACTIVE: "Active",
  ON_LEAVE: "On leave",
  SUSPENDED: "Suspended",
  LEFT: "Left",
};

const EMPLOYMENT_CLASSES: Record<EmploymentStatus, string> = {
  ACTIVE: "status-active",
  ON_LEAVE: "status-expiring",
  SUSPENDED: "status-expired",
  LEFT: "status-neutral",
};

export function EmploymentStatusBadge({ status }: { status: EmploymentStatus }) {
  return <span className={`status-badge ${EMPLOYMENT_CLASSES[status]}`}>{EMPLOYMENT_LABELS[status]}</span>;
}

const VETTING_INVITE_LABELS: Record<VettingInviteStatus, string> = {
  PENDING: "Link sent",
  SUBMITTED: "Submitted",
  CONVERTED: "Added to roster",
};

const VETTING_INVITE_CLASSES: Record<VettingInviteStatus, string> = {
  PENDING: "status-pending",
  SUBMITTED: "status-confirmed",
  CONVERTED: "status-active",
};

export function VettingInviteStatusBadge({ status }: { status: VettingInviteStatus }) {
  return <span className={`status-badge ${VETTING_INVITE_CLASSES[status]}`}>{VETTING_INVITE_LABELS[status]}</span>;
}
