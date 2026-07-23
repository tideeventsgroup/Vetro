import type { CandidateStatus, CheckStatus, DataRequestStatus } from "../lib/api.js";
import type { DashboardColour } from "../lib/status.js";

const CHECK_LABELS: Record<CheckStatus, string> = {
  NOT_STARTED: "Not started",
  PENDING: "Pending review",
  VERIFIED: "Verified",
  EXPIRED: "Expired",
  REJECTED: "Rejected",
};

const CHECK_CLASSES: Record<CheckStatus, string> = {
  NOT_STARTED: "status-neutral",
  PENDING: "status-pending",
  VERIFIED: "status-active",
  EXPIRED: "status-expired",
  REJECTED: "status-expired",
};

export function CheckStatusBadge({ status }: { status: CheckStatus }) {
  return <span className={`status-badge ${CHECK_CLASSES[status]}`}>{CHECK_LABELS[status]}</span>;
}

const CANDIDATE_LABELS: Record<CandidateStatus, string> = {
  INVITED: "Invited",
  IN_PROGRESS: "In progress",
  SUBMITTED: "Submitted",
  ARCHIVED: "Archived",
};

const CANDIDATE_CLASSES: Record<CandidateStatus, string> = {
  INVITED: "status-neutral",
  IN_PROGRESS: "status-pending",
  SUBMITTED: "status-confirmed",
  ARCHIVED: "status-neutral",
};

export function CandidateStatusBadge({ status }: { status: CandidateStatus }) {
  return <span className={`status-badge ${CANDIDATE_CLASSES[status]}`}>{CANDIDATE_LABELS[status]}</span>;
}

const DATA_REQUEST_LABELS: Record<DataRequestStatus, string> = {
  PENDING: "Pending",
  COMPLETED: "Completed",
};

const DATA_REQUEST_CLASSES: Record<DataRequestStatus, string> = {
  PENDING: "status-pending",
  COMPLETED: "status-active",
};

export function DataRequestStatusBadge({ status }: { status: DataRequestStatus }) {
  return <span className={`status-badge ${DATA_REQUEST_CLASSES[status]}`}>{DATA_REQUEST_LABELS[status]}</span>;
}

const DASHBOARD_LABELS: Record<DashboardColour, string> = {
  green: "Fully verified",
  amber: "Needs attention",
  red: "Missing or expired",
};

const DASHBOARD_CLASSES: Record<DashboardColour, string> = {
  green: "status-active",
  amber: "status-expiring",
  red: "status-expired",
};

/** The dashboard's per-candidate rollup badge — see lib/status.ts's worstCheckColour. */
export function DashboardColourBadge({ colour }: { colour: DashboardColour }) {
  return <span className={`status-badge ${DASHBOARD_CLASSES[colour]}`}>{DASHBOARD_LABELS[colour]}</span>;
}
