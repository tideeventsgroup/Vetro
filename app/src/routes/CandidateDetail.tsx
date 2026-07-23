import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CandidateStatusBadge, CheckStatusBadge } from "../components/StatusBadge.js";
import { ArrowLeftIcon, DownloadIcon, FileIcon, TrashIcon } from "../components/icons.js";
import { Candidate, Check, SIA_REGISTER_URL, useApi } from "../lib/api.js";
import { checkTypeLabel } from "../lib/status.js";
import { useTenantSlug } from "../lib/tenant.js";

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
      <div className="card-header">
        <h2>{checkTypeLabel(check.checkType)}</h2>
        <CheckStatusBadge status={check.status} />
      </div>

      {check.checkType === "RIGHT_TO_WORK" && (
        <p className="subtle-meta" style={{ marginBottom: 12 }}>
          This tracks a self-reported right to work document only — it does not satisfy the statutory
          right to work check. A separate Home Office check is a legal requirement before employment.
        </p>
      )}

      {check.checkType === "SIA_LICENCE" && (
        <p className="subtle-meta" style={{ marginBottom: 12 }}>
          There's no public API for the SIA register — cross-check the licence number yourself, then
          confirm the result here.{" "}
          <a href={SIA_REGISTER_URL} target="_blank" rel="noreferrer">
            Check on the SIA register ↗
          </a>
        </p>
      )}

      {error && <p className="error-text">{error}</p>}

      <div style={{ display: "flex", gap: 8 }}>
        {check.checkType === "SIA_LICENCE" && (
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor={`licence-${check.id}`}>Licence number</label>
            <input id={`licence-${check.id}`} value={licenceNumber} onChange={(e) => setLicenceNumber(e.target.value)} />
          </div>
        )}
        {check.checkType !== "ID_DOCUMENT" && (
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor={`expiry-${check.id}`}>Expiry date</label>
            <input id={`expiry-${check.id}`} type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
          </div>
        )}
      </div>

      <div className="form-field">
        <label htmlFor={`notes-${check.id}`}>Notes</label>
        <textarea id={`notes-${check.id}`} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {check.documents && check.documents.length > 0 && (
        <table className="data-table" style={{ marginBottom: 12 }}>
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

      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-primary" disabled={isSaving} onClick={() => review("VERIFIED")}>
          Verify
        </button>
        <button className="btn btn-secondary" disabled={isSaving} onClick={() => review("PENDING")}>
          Request more info
        </button>
        <button className="btn btn-secondary" disabled={isSaving} onClick={() => review("REJECTED")}>
          Reject
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    void load();
  }, [id]);

  async function load() {
    if (!id) return;
    setIsLoading(true);
    try {
      setCandidate(await api.getCandidate(id));
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

  return (
    <div>
      <Link to={`/${tenant}`} className="subtle-meta" style={{ display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 12 }}>
        <ArrowLeftIcon width={14} height={14} />
        Back to candidates
      </Link>

      <div className="page-header">
        <div>
          <h1>
            {candidate.firstName} {candidate.lastName}
          </h1>
          <p>
            {candidate.email} · {candidate.roleType?.name ?? "No role type"} ·{" "}
            <CandidateStatusBadge status={candidate.status} />
          </p>
        </div>
        <div className="page-actions">
          <Link className="btn btn-secondary" to={`/${tenant}/candidates/${candidate.id}/report`} target="_blank">
            <FileIcon width={14} height={14} />
            Export report
          </Link>
          <button className="btn btn-secondary" onClick={handleDelete}>
            <TrashIcon width={14} height={14} />
            Remove candidate
          </button>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {candidate.checks.map((check) => (
        <CheckCard key={check.id} candidateId={candidate.id} check={check} onChanged={load} />
      ))}
    </div>
  );
}
