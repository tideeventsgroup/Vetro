import { ChangeEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckStatusBadge } from "../components/StatusBadge.js";
import { FileIcon } from "../components/icons.js";
import { Check, PublicCandidate, useApi } from "../lib/api.js";
import { checkTypeLabel } from "../lib/status.js";

const CHECK_DESCRIPTIONS: Record<Check["checkType"], string> = {
  SIA_LICENCE: "Upload your SIA licence, front and back.",
  RIGHT_TO_WORK: "Passport, visa, or share code confirming your right to work in the UK.",
  ID_DOCUMENT: "A valid passport or driving licence.",
  FIRST_AID: "Your current in-date first aid at work certificate.",
  TRAINING: "The certificate for this training or competency.",
  DBS_CHECK: "Basic disclosure check for this role.",
};

// Which checks ask for a reference/certificate number alongside the
// expiry date — the rest just take a document, no extra fields.
const REFERENCE_FIELD_LABEL: Partial<Record<Check["checkType"], string>> = {
  SIA_LICENCE: "SIA licence number",
  FIRST_AID: "Certificate number",
  TRAINING: "Certificate number",
};

// DBS_CHECK never gets an upload control at all — it's tracked status only
// (see prisma/schema.prisma's CheckType comment); the candidate can't do
// anything about it here, so it's excluded from the "documents required"
// count and the submit gate too.
const UPLOADABLE_CHECK_TYPES = new Set<Check["checkType"]>(["SIA_LICENCE", "RIGHT_TO_WORK", "ID_DOCUMENT", "FIRST_AID", "TRAINING"]);

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
  const [referenceNumber, setReferenceNumber] = useState(check.licenceNumber ?? "");
  const [expiryDate, setExpiryDate] = useState(check.expiryDate ? check.expiryDate.slice(0, 10) : "");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const referenceFieldLabel = REFERENCE_FIELD_LABEL[check.checkType];
  const uploaded = check.status !== "NOT_STARTED";

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(undefined);
    setIsUploading(true);
    try {
      await api.uploadCandidateDocument(token, check.id, file, {
        licenceNumber: referenceFieldLabel ? referenceNumber || undefined : undefined,
        expiryDate: referenceFieldLabel ? expiryDate || undefined : undefined,
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
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{checkTypeLabel(check.checkType)}</div>
        <CheckStatusBadge status={check.status} />
      </div>
      <div style={{ fontSize: 12, color: "var(--lunara-text-muted)", marginTop: 4 }}>{CHECK_DESCRIPTIONS[check.checkType]}</div>

      {check.checkType === "DBS_CHECK" && (
        <div className="check-card-partner-pending">
          <span className="info-dot">i</span>
          Pending partner integration
        </div>
      )}
      {check.checkType === "RIGHT_TO_WORK" && (
        <div style={{ fontSize: 12, color: "var(--lunara-text-muted)", marginTop: 6 }}>
          Uploading this does not itself satisfy your statutory right to work check — a separate Home
          Office check is still a legal requirement.
        </div>
      )}

      {error && <p className="error-text">{error}</p>}

      {check.documents && check.documents.length > 0 && (
        <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
          {check.documents.map((doc) => (
            <li key={doc.id} style={{ fontSize: 13 }}>
              {doc.fileName}
            </li>
          ))}
        </ul>
      )}

      {UPLOADABLE_CHECK_TYPES.has(check.checkType) && (
        <>
          <label className={`selfserve-upload-button${uploaded ? " uploaded" : ""}`}>
            {isUploading ? "Uploading…" : uploaded ? "✓ Uploaded — tap to replace" : "Tap to upload or drag a file here"}
            <input type="file" onChange={handleFileChange} disabled={isUploading} style={{ display: "none" }} />
          </label>
          {referenceFieldLabel && (
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <input
                className="input"
                placeholder={referenceFieldLabel}
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                style={{ flex: 1, minWidth: 0 }}
              />
              <input
                className="input"
                type="date"
                placeholder="Expiry date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                style={{ width: 130 }}
              />
            </div>
          )}
        </>
      )}
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
        <img src="/brand/lunara-icon.svg" alt="" width="40" height="40" style={{ borderRadius: 11, marginBottom: 16 }} />
        <p className="error-text">{error}</p>
      </div>
    );
  }

  const requiredChecks = candidate.checks.filter((c) => UPLOADABLE_CHECK_TYPES.has(c.checkType));
  const doneCount = requiredChecks.filter((c) => c.status !== "NOT_STARTED").length;
  const progressPct = requiredChecks.length ? Math.round((doneCount / requiredChecks.length) * 100) : 0;
  const allDone = doneCount === requiredChecks.length;

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", paddingBottom: 100 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "24px 20px 16px", background: "var(--lunara-surface)", borderBottom: "1px solid var(--lunara-border)" }}>
        <img src="/brand/lunara-icon.svg" alt="" width="40" height="40" style={{ borderRadius: 11 }} />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "var(--lunara-font-display)", fontWeight: 700, fontSize: 16 }}>Lunara Screening</div>
          <div style={{ fontSize: 13, color: "var(--lunara-text-muted)", marginTop: 6, maxWidth: 280 }}>
            Hi {candidate.firstName}, {candidate.organisation.name} needs a few documents to complete your
            compliance check.
          </div>
        </div>
      </div>

      <div style={{ padding: "16px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: "var(--lunara-text-muted)", marginBottom: 6 }}>
          <span>Progress</span>
          <span>{doneCount} of {requiredChecks.length} complete</span>
        </div>
        <div className="selfserve-progress-track">
          <div className="selfserve-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {error && <p className="error-text" style={{ margin: "16px 20px 0" }}>{error}</p>}

      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
        {candidate.checks.map((check) => (
          <CandidateCheckCard key={check.id} token={token!} check={check} onChanged={load} />
        ))}
      </div>

      <div style={{ padding: "0 20px 24px" }}>
        {candidate.status !== "SUBMITTED" ? (
          <>
            <button className="selfserve-submit-button" disabled={isSubmitting || !allDone} onClick={handleSubmit}>
              {isSubmitting ? "Submitting…" : "Submit for review"}
            </button>
            <p style={{ fontSize: 11, color: "var(--lunara-silver)", textAlign: "center", marginTop: 12, lineHeight: 1.5 }}>
              Your documents are stored securely and only used to verify your compliance checks for this
              role. They are never shared beyond what is required by law.
            </p>
          </>
        ) : (
          <div className="card" style={{ textAlign: "center" }}>
            Submitted — {candidate.organisation.name} will review your documents.
          </div>
        )}
      </div>

      <div style={{ padding: "0 20px" }}>
        <div className="card">
          <div className="card-header">
            <h2 style={{ fontSize: 15 }}>Your data</h2>
          </div>
          <p style={{ fontSize: 12, color: "var(--lunara-text-muted)", marginBottom: 12 }}>
            Everything shown on this page is everything held about you. You can ask for a copy or ask for
            it to be deleted at any time.
          </p>
          {dataRequestStatus && <p style={{ fontSize: 12, color: "var(--lunara-status-green-text)", marginBottom: 12 }}>{dataRequestStatus}</p>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-secondary" onClick={() => handleDataRequest("ACCESS")}>
              <FileIcon width={14} height={14} />
              Request a copy of my data
            </button>
            <button className="btn btn-secondary" onClick={() => handleDataRequest("DELETE")}>
              Request deletion
            </button>
          </div>
        </div>

        <p style={{ fontSize: 11, color: "var(--lunara-silver)", marginTop: 8 }}>
          Lunara Screening is not a DBS Registered Body or Umbrella Body. DBS, PVG, and Disclosure Scotland
          checks require an accredited partner and are not performed by this product today.
        </p>
      </div>
    </div>
  );
}
