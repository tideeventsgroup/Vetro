import { ChangeEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckStatusBadge } from "../components/StatusBadge.js";
import { CheckIcon, FileIcon, ShieldCheckIcon, UploadIcon } from "../components/icons.js";
import { Check, PublicCandidate, useApi } from "../lib/api.js";
import { checkTypeLabel } from "../lib/status.js";

const HAS_EXPIRY: Record<Check["checkType"], boolean> = {
  SIA_LICENCE: true,
  FIRST_AID: true,
  RIGHT_TO_WORK: true,
  ID_DOCUMENT: false,
  TRAINING: true,
};

function CandidateCheckCard({
  token,
  check,
  onChanged,
}: {
  token: string;
  check: Check;
  onChanged: () => void;
}) {
  const api = useApi();
  const [licenceNumber, setLicenceNumber] = useState(check.licenceNumber ?? "");
  const [expiryDate, setExpiryDate] = useState(check.expiryDate ? check.expiryDate.slice(0, 10) : "");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(undefined);
    setIsUploading(true);
    try {
      await api.uploadCandidateDocument(token, check.id, file, {
        licenceNumber: check.checkType === "SIA_LICENCE" ? licenceNumber || undefined : undefined,
        expiryDate: HAS_EXPIRY[check.checkType] ? expiryDate || undefined : undefined,
      });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
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
          Uploading this document does not itself satisfy your statutory right to work check — your
          employer still needs to carry out a separate Home Office check.
        </p>
      )}

      {error && <p className="error-text">{error}</p>}

      {check.documents && check.documents.length > 0 && (
        <ul style={{ marginBottom: 12, paddingLeft: 18 }}>
          {check.documents.map((doc) => (
            <li key={doc.id} style={{ fontSize: 14 }}>
              {doc.fileName}
            </li>
          ))}
        </ul>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {check.checkType === "SIA_LICENCE" && (
          <div className="form-field" style={{ flex: 1, minWidth: 160 }}>
            <label htmlFor={`licence-${check.id}`}>SIA licence number</label>
            <input id={`licence-${check.id}`} value={licenceNumber} onChange={(e) => setLicenceNumber(e.target.value)} />
          </div>
        )}
        {HAS_EXPIRY[check.checkType] && (
          <div className="form-field" style={{ flex: 1, minWidth: 160 }}>
            <label htmlFor={`expiry-${check.id}`}>Expiry date</label>
            <input id={`expiry-${check.id}`} type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
          </div>
        )}
      </div>

      <label className="btn btn-secondary" style={{ display: "inline-flex", cursor: "pointer", marginTop: 8 }}>
        <UploadIcon width={14} height={14} />
        {isUploading ? "Uploading…" : "Upload document"}
        <input type="file" onChange={handleFileChange} disabled={isUploading} style={{ display: "none" }} />
      </label>
    </div>
  );
}

export function CandidateSelfService() {
  const { token } = useParams<{ token: string }>();
  const api = useApi();
  const [candidate, setCandidate] = useState<PublicCandidate | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dataRequestStatus, setDataRequestStatus] = useState<string | undefined>(undefined);

  useEffect(() => {
    void load();
  }, [token]);

  async function load() {
    if (!token) return;
    setIsLoading(true);
    try {
      setCandidate(await api.getPublicCandidate(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "This link isn't valid — ask your organisation to send a new one");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit() {
    if (!token) return;
    setIsSubmitting(true);
    try {
      setCandidate(await api.submitCandidate(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDataRequest(type: "ACCESS" | "DELETE") {
    if (!token) return;
    const verb = type === "DELETE" ? "request deletion of your data" : "request a copy of your data";
    if (!window.confirm(`Are you sure you want to ${verb}? Your organisation will be notified.`)) return;
    try {
      await api.createCandidateDataRequest(token, type);
      setDataRequestStatus(type === "DELETE" ? "Deletion requested — your organisation will action this shortly." : "Access request sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send request");
    }
  }

  if (isLoading) return <p style={{ padding: 24, color: "var(--lunara-text-muted)" }}>Loading…</p>;
  if (!candidate) {
    return (
      <div style={{ maxWidth: 460, margin: "80px auto", padding: 24, textAlign: "center" }}>
        <img src="/brand/lunara-logo-horizontal.svg" alt="Lunara Screening" height="32" style={{ marginBottom: 24 }} />
        <p className="error-text">{error}</p>
      </div>
    );
  }

  const allSubmitted = candidate.checks.every((c) => c.status !== "NOT_STARTED");

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px 64px" }}>
      <img src="/brand/lunara-logo-horizontal.svg" alt="Lunara Screening" height="32" style={{ marginBottom: 24 }} />

      <div className="page-header">
        <div>
          <h1>
            Hi {candidate.firstName}, {candidate.organisation.name} needs a few documents
          </h1>
          <p>Upload each item below — it's reviewed by {candidate.organisation.name}, not automatically approved.</p>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {candidate.checks.map((check) => (
        <CandidateCheckCard key={check.id} token={token!} check={check} onChanged={load} />
      ))}

      {candidate.status !== "SUBMITTED" && (
        <button className="btn btn-primary" disabled={isSubmitting || !allSubmitted} onClick={handleSubmit} style={{ marginTop: 8 }}>
          <CheckIcon width={14} height={14} />
          {isSubmitting ? "Submitting…" : "I've uploaded everything"}
        </button>
      )}
      {!allSubmitted && candidate.status !== "SUBMITTED" && (
        <p className="subtle-meta" style={{ marginTop: 8 }}>
          Upload every item above before submitting.
        </p>
      )}
      {candidate.status === "SUBMITTED" && (
        <div className="card" style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
          <ShieldCheckIcon />
          <span>Submitted — {candidate.organisation.name} will review your documents.</span>
        </div>
      )}

      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header">
          <h2>Your data</h2>
        </div>
        <p className="subtle-meta" style={{ marginBottom: 12 }}>
          Everything shown on this page is everything held about you. You can ask for a copy or ask for
          it to be deleted at any time.
        </p>
        {dataRequestStatus && <p className="subtle-meta">{dataRequestStatus}</p>}
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => handleDataRequest("ACCESS")}>
            <FileIcon width={14} height={14} />
            Request a copy of my data
          </button>
          <button className="btn btn-secondary" onClick={() => handleDataRequest("DELETE")}>
            Request deletion
          </button>
        </div>
      </div>

      <p className="subtle-meta" style={{ marginTop: 24 }}>
        Lunara Screening is not a DBS Registered Body or Umbrella Body. DBS, PVG, and Disclosure Scotland
        checks require an accredited partner and are not performed by this product today.
      </p>
    </div>
  );
}
