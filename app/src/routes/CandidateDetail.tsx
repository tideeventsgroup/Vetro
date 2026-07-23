import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CheckStatusBadge } from "../components/StatusBadge.js";
import { ArrowLeftIcon, DownloadIcon, TrashIcon } from "../components/icons.js";
import { AuditLogEntry, Candidate, Check, SIA_REGISTER_URL, useApi } from "../lib/api.js";
import { checkTypeLabel, overallCheckState } from "../lib/status.js";
import { useTenantSlug } from "../lib/tenant.js";

const OVERALL_LABELS: Record<ReturnType<typeof overallCheckState>, string> = {
  verified: "Verified",
  pending: "Pending",
  rejected: "Rejected",
};

const OVERALL_CLASSES: Record<ReturnType<typeof overallCheckState>, string> = {
  verified: "status-active",
  pending: "status-pending",
  rejected: "status-expired",
};

function fileLabel(checkType: Check["checkType"]): string {
  return `${checkTypeLabel(checkType).toLowerCase().replace(/[^a-z0-9]+/g, "_")}.pdf`;
}

// Turns a raw AuditLogEntry into the plain-English line the mockup's audit
// trail shows — the entry itself only carries an action string plus
// whatever metadata the writer recorded (see backend/src/lib/audit.ts).
function describeAuditEntry(entry: AuditLogEntry): string {
  const meta = (entry.metadata ?? {}) as { checkType?: Check["checkType"]; status?: string; type?: string };
  switch (entry.action) {
    case "candidate.invited":
      return "Invite sent";
    case "candidate.submitted":
      return "Candidate submitted documents for review";
    case "document.uploaded":
      return meta.checkType ? `${checkTypeLabel(meta.checkType)} document uploaded` : "Document uploaded";
    case "document.viewed":
      return meta.checkType ? `${checkTypeLabel(meta.checkType)} document viewed` : "Document viewed";
    case "check.reviewed": {
      if (!meta.checkType) return "Check reviewed";
      const label = checkTypeLabel(meta.checkType);
      if (meta.status === "VERIFIED") return `${label} approved`;
      if (meta.status === "REJECTED") return `${label} rejected`;
      if (meta.status === "PENDING") return `${label} — more information requested`;
      return `${label} updated`;
    }
    case "data_request.raised":
      return meta.type === "DELETE" ? "Requested deletion of their data" : "Requested a copy of their data";
    case "data_request.resolved":
      return "Data request resolved";
    default:
      return entry.action.replace(/[._]/g, " ");
  }
}

function CheckCard({
  candidateId,
  check,
  onChanged,
}: {
  candidateId: string;
  check: Check;
  onChanged: () => void;
}) {
  const api = useApi();
  const [licenceNumber, setLicenceNumber] = useState(check.licenceNumber ?? "");
  const [expiryDate, setExpiryDate] = useState(check.expiryDate ? check.expiryDate.slice(0, 10) : "");
  const [notes, setNotes] = useState(check.notes ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  async function review(status: "VERIFIED" | "REJECTED" | "PENDING") {
    setError(undefined);
    setIsSaving(true);
    try {
      await api.reviewCheck(candidateId, check.id, {
        status,
        notes: notes || undefined,
        expiryDate: expiryDate || null,
        licenceNumber: licenceNumber || undefined,
      });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update check");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDownload(documentId: string) {
    try {
      const url = await api.getCheckDocumentDownloadUrl(candidateId, check.id, documentId);
      window.open(url, "_blank");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not get download link");
    }
  }

  return (
    <div className="card">
      <div className="check-card-head">
        <div style={{ display: "flex", gap: 14 }}>
          <div className="check-card-file-icon">{fileLabel(check.checkType)}</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{checkTypeLabel(check.checkType)}</div>
            {check.checkType === "RIGHT_TO_WORK" && (
              <div style={{ fontSize: 13, color: "var(--lunara-text-muted)", marginTop: 4, maxWidth: 340 }}>
                This tracks a self-reported document only — it does not satisfy the statutory right to work
                check, which remains a separate legal requirement.
              </div>
            )}
            {check.checkType === "SIA_LICENCE" && (
              <div style={{ fontSize: 13, color: "var(--lunara-text-muted)", marginTop: 4, maxWidth: 340 }}>
                Cross-check the licence number yourself against the official register, then confirm here.
              </div>
            )}
            {check.checkType === "DBS_CHECK" && (
              <div className="check-card-partner-pending">
                <span className="info-dot">i</span>
                Pending partner integration — not yet verified automatically
              </div>
            )}
          </div>
        </div>
        <CheckStatusBadge status={check.status} />
      </div>

      {check.checkType === "SIA_LICENCE" && (
        <p style={{ marginTop: 12, marginBottom: 0 }}>
          <a href={SIA_REGISTER_URL} target="_blank" rel="noreferrer">
            Check on the SIA register ↗
          </a>
        </p>
      )}

      {error && <p className="error-text">{error}</p>}

      {check.documents && check.documents.length > 0 && (
        <table className="data-table" style={{ marginTop: 14 }}>
          <thead>
            <tr>
              <th>Document</th>
              <th>Uploaded</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {check.documents.map((doc) => (
              <tr key={doc.id}>
                <td>{doc.fileName}</td>
                <td>{new Date(doc.uploadedAt).toLocaleDateString("en-GB")}</td>
                <td>
                  <button className="btn btn-secondary" onClick={() => handleDownload(doc.id)}>
                    <DownloadIcon width={14} height={14} />
                    Download
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {check.checkType !== "DBS_CHECK" && (
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          {check.checkType === "SIA_LICENCE" && (
            <div className="form-field" style={{ flex: 1, marginBottom: 0 }}>
              <label htmlFor={`licence-${check.id}`}>Licence number</label>
              <input id={`licence-${check.id}`} value={licenceNumber} onChange={(e) => setLicenceNumber(e.target.value)} />
            </div>
          )}
          {check.checkType !== "ID_DOCUMENT" && (
            <div className="form-field" style={{ flex: 1, marginBottom: 0 }}>
              <label htmlFor={`expiry-${check.id}`}>Expiry date</label>
              <input id={`expiry-${check.id}`} type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
            </div>
          )}
        </div>
      )}

      <div className="form-field" style={{ marginTop: 14, marginBottom: 0 }}>
        <label htmlFor={`notes-${check.id}`}>Notes</label>
        <textarea id={`notes-${check.id}`} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div className="check-card-actions">
        <button className="check-card-action check-card-action-approve" disabled={isSaving} onClick={() => review("VERIFIED")}>
          Approve
        </button>
        <button className="check-card-action check-card-action-reject" disabled={isSaving} onClick={() => review("REJECTED")}>
          Reject
        </button>
        <button className="check-card-action check-card-action-info" disabled={isSaving} onClick={() => review("PENDING")}>
          Request more info
        </button>
      </div>
    </div>
  );
}

export function CandidateDetail() {
  const { id } = useParams<{ id: string }>();
  const api = useApi();
  const navigate = useNavigate();
  const tenant = useTenantSlug();
  const [candidate, setCandidate] = useState<Candidate | undefined>(undefined);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    void load();
  }, [id]);

  async function load() {
    if (!id) return;
    setIsLoading(true);
    try {
      const [candidateResult, auditResult] = await Promise.all([api.getCandidate(id), api.listAuditLog()]);
      setCandidate(candidateResult);
      setAuditLog(auditResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load candidate");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete() {
    if (!candidate) return;
    if (!window.confirm(`Remove ${candidate.firstName} ${candidate.lastName}? This deletes their checks and documents too.`)) return;
    try {
      await api.deleteCandidate(candidate.id);
      navigate(`/${tenant}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete candidate");
    }
  }

  if (isLoading) return <p style={{ color: "var(--lunara-text-muted)" }}>Loading…</p>;
  if (!candidate) return <p className="error-text">{error ?? "Candidate not found"}</p>;

  const relevantIds = new Set([candidate.id, ...candidate.checks.map((c) => c.id)]);
  const candidateAudit = auditLog.filter((entry) => relevantIds.has(entry.entityId)).reverse();
  const overall = overallCheckState(candidate);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div className="page-header">
        <div>
          <Link
            to={`/${tenant}`}
            style={{ display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 8, color: "#B8C2CC", fontSize: 13, fontWeight: 600 }}
          >
            <ArrowLeftIcon width={14} height={14} />
            Back to dashboard
          </Link>
          <h1>
            {candidate.firstName} {candidate.lastName}
          </h1>
          <p>
            {candidate.roleType?.name ?? "No role type"} · {candidate.email}
          </p>
        </div>
        <div className="page-actions">
          <span className={`status-badge ${OVERALL_CLASSES[overall]}`}>{OVERALL_LABELS[overall]}</span>
          <Link className="btn btn-dark" to={`/${tenant}/candidates/${candidate.id}/report`} target="_blank">
            Generate report
          </Link>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 24, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {candidate.checks.map((check) => (
            <CheckCard key={check.id} candidateId={candidate.id} check={check} onChanged={load} />
          ))}
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Audit trail</h2>
          </div>
          {candidateAudit.length === 0 ? (
            <p className="subtle-meta">No activity recorded yet.</p>
          ) : (
            <div>
              {candidateAudit.map((entry) => (
                <div key={entry.id} className="audit-timeline-item">
                  <span className="audit-timeline-dot" />
                  <div className="audit-timeline-date">{new Date(entry.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</div>
                  <div className="audit-timeline-text">{describeAuditEntry(entry)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <button className="btn btn-secondary" onClick={handleDelete}>
          <TrashIcon width={14} height={14} />
          Remove candidate
        </button>
      </div>
    </div>
  );
}
