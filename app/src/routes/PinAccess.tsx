import { ChangeEvent, FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { StatusBadge } from "../components/StatusBadge.js";
import { CheckIcon, PlusIcon, ShieldCheckIcon, TrashIcon, UploadIcon } from "../components/icons.js";
import { PinAccessStatus, useApi } from "../lib/api.js";

interface AddressRow {
  address: string;
  from: string;
  to: string;
}

interface EmploymentRow {
  employer: string;
  role: string;
  from: string;
  to: string;
}

interface ReferenceRow {
  name: string;
  relationship: string;
  contact: string;
}

const EMPTY_ADDRESS: AddressRow = { address: "", from: "", to: "" };
const EMPTY_EMPLOYMENT: EmploymentRow = { employer: "", role: "", from: "", to: "" };
const EMPTY_REFERENCE: ReferenceRow = { name: "", relationship: "", contact: "" };

// An officer's own way into their vetting record — no Cognito account, just
// the PIN they were given when added (see Officer.pin in prisma/schema.prisma
// and backend/src/routes/pinAccess.ts). Public, not behind ProtectedLayout —
// same branded shell as CandidateVetting.tsx, since this is also reached
// without ever signing in.
export function PinAccess() {
  const api = useApi();
  const [pin, setPin] = useState("");
  const [status, setStatus] = useState<PinAccessStatus | undefined>(undefined);
  const [verifyError, setVerifyError] = useState<string | undefined>(undefined);
  const [isVerifying, setIsVerifying] = useState(false);

  const [addresses, setAddresses] = useState<AddressRow[]>([EMPTY_ADDRESS]);
  const [employment, setEmployment] = useState<EmploymentRow[]>([EMPTY_EMPLOYMENT]);
  const [references, setReferences] = useState<ReferenceRow[]>([EMPTY_REFERENCE]);
  const [consentGiven, setConsentGiven] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);
  const [submitted, setSubmitted] = useState(false);
  const [uploadError, setUploadError] = useState<string | undefined>(undefined);
  const [isUploading, setIsUploading] = useState(false);

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setVerifyError(undefined);
    setIsVerifying(true);
    try {
      const result = await api.verifyPinAccess(pin.trim());
      setStatus(result);
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : "Could not verify PIN");
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(undefined);
    if (!consentGiven) {
      setSubmitError("You must give consent before submitting.");
      return;
    }
    setIsSubmitting(true);
    try {
      await api.submitPinVetting(pin.trim(), {
        addressHistory: addresses.filter((a) => a.address.trim()),
        employmentHistory: employment.filter((e2) => e2.employer.trim()),
        references: references.filter((r) => r.name.trim()),
        consentGiven,
      });
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not submit your details");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !status) return;
    setUploadError(undefined);
    setIsUploading(true);
    try {
      const doc = await api.uploadPinDocument(pin.trim(), file, "Identity document");
      setStatus((current) =>
        current
          ? {
              ...current,
              documents: [...current.documents.filter((d) => d.kind !== doc.kind), doc],
            }
          : current
      );
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Could not upload file");
    } finally {
      setIsUploading(false);
    }
  }

  if (!status) {
    return (
      <div className="candidate-vetting-shell">
        <div className="candidate-vetting-topbar">
          <img src="/brand/vetro-logo-horizontal-dark.svg" alt="Vetro" height="24" />
        </div>
        <div className="candidate-vetting-state">
          <div className="candidate-vetting-state-card">
            <span className="empty-icon" style={{ background: "var(--vetro-teal-light)", color: "var(--vetro-teal-dark)" }}>
              <ShieldCheckIcon />
            </span>
            <h2 style={{ fontSize: 18, margin: "8px 0" }}>Enter your PIN</h2>
            <p style={{ color: "var(--vetro-text-muted)", fontSize: 14, marginBottom: 16 }}>
              Use the PIN you were given when you were added, to view your vetting status and submit your details.
            </p>
            <form onSubmit={handleVerify}>
              {verifyError && <p className="error-text">{verifyError}</p>}
              <div className="form-field">
                <input
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  style={{ textAlign: "center", fontSize: 24, letterSpacing: 4, fontFamily: "var(--vetro-font-mono, monospace)" }}
                />
              </div>
              <button className="btn btn-primary btn-pill" type="submit" disabled={isVerifying} style={{ width: "100%" }}>
                {isVerifying ? "Checking…" : "Continue"}
              </button>
            </form>
            <p className="subtle-meta" style={{ marginTop: 16 }}>
              Admin? <Link to="/login">Sign in here</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="candidate-vetting-shell">
        <div className="candidate-vetting-topbar">
          <img src="/brand/vetro-logo-horizontal-dark.svg" alt="Vetro" height="24" />
        </div>
        <div className="candidate-vetting-state">
          <div className="candidate-vetting-state-card">
            <span className="empty-icon" style={{ background: "var(--vetro-teal-light)", color: "var(--vetro-teal-dark)" }}>
              <ShieldCheckIcon />
            </span>
            <h2 style={{ fontSize: 18, margin: "8px 0" }}>Thanks, {status.firstName}</h2>
            <p style={{ color: "var(--vetro-text-muted)", fontSize: 14 }}>
              {status.organisationName} has received your details and will be in touch once they've been reviewed.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const identityDoc = status.documents.find((d) => d.kind === "Identity document");

  return (
    <div className="candidate-vetting-shell">
      <div className="candidate-vetting-topbar">
        <img src="/brand/vetro-logo-horizontal-dark.svg" alt="Vetro" height="24" />
      </div>

      <div className="candidate-vetting-content">
        <div className="candidate-vetting-intro">
          <span className="empty-icon" style={{ background: "var(--vetro-teal-light)", color: "var(--vetro-teal-dark)", flexShrink: 0 }}>
            <ShieldCheckIcon />
          </span>
          <div>
            <h1>Hi {status.firstName}</h1>
            <p>Your vetting record with {status.organisationName}.</p>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Vetting status</h2>
          </div>
          {status.vettingRecords.length === 0 && status.dbsChecks.length === 0 ? (
            <p className="subtle-meta">No vetting records on file yet.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {status.vettingRecords.map((v) => (
                <li key={v.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14 }}>
                  <span>{v.standard}</span>
                  <StatusBadge status={v.status} />
                </li>
              ))}
              {status.dbsChecks.map((d) => (
                <li key={d.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14 }}>
                  <span>DBS — {d.level}</span>
                  <StatusBadge status={d.status} />
                </li>
              ))}
            </ul>
          )}
          <p style={{ fontSize: 14, marginTop: 12 }}>
            Right to work: <strong>{status.rightToWorkConfirmed ? "Confirmed" : "Not confirmed"}</strong>
            {status.rightToWorkExpiryDate ? ` (expires ${status.rightToWorkExpiryDate.slice(0, 10)})` : ""}
          </p>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Identity document</h2>
          </div>
          {uploadError && <p className="error-text">{uploadError}</p>}
          {identityDoc ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CheckIcon width={14} height={14} style={{ color: "var(--vetro-status-green-text)" }} />
              <span style={{ fontSize: 13 }}>Uploaded</span>
            </div>
          ) : (
            <label className="btn btn-secondary" style={{ display: "inline-flex", width: "fit-content", cursor: isUploading ? "default" : "pointer" }}>
              <UploadIcon width={14} height={14} />
              {isUploading ? "Uploading…" : "Upload file"}
              <input type="file" accept="image/*,application/pdf" style={{ display: "none" }} disabled={isUploading} onChange={handleUpload} />
            </label>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Submit or update your details</h2>
          </div>
          <form onSubmit={handleSubmit}>
            {submitError && <p className="error-text">{submitError}</p>}

            <h3 style={{ fontSize: 14, marginBottom: 8 }}>Address history (last 5 years)</h3>
            {addresses.map((row, i) => (
              <div className="repeater-row" key={i}>
                <div className="repeater-row-fields">
                  <div className="form-field" style={{ marginBottom: 0, flex: 2, minWidth: 200 }}>
                    <label>Address</label>
                    <input
                      value={row.address}
                      onChange={(e) =>
                        setAddresses((rows) => rows.map((r, idx) => (idx === i ? { ...r, address: e.target.value } : r)))
                      }
                    />
                  </div>
                  <div className="form-field" style={{ marginBottom: 0, minWidth: 130 }}>
                    <label>From</label>
                    <input
                      type="month"
                      value={row.from}
                      onChange={(e) => setAddresses((rows) => rows.map((r, idx) => (idx === i ? { ...r, from: e.target.value } : r)))}
                    />
                  </div>
                  <div className="form-field" style={{ marginBottom: 0, minWidth: 130 }}>
                    <label>To</label>
                    <input
                      type="month"
                      value={row.to}
                      onChange={(e) => setAddresses((rows) => rows.map((r, idx) => (idx === i ? { ...r, to: e.target.value } : r)))}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary repeater-remove"
                  aria-label="Remove address"
                  onClick={() => setAddresses((rows) => rows.filter((_, idx) => idx !== i))}
                >
                  <TrashIcon width={14} height={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-secondary"
              style={{ marginBottom: 20 }}
              onClick={() => setAddresses((rows) => [...rows, { ...EMPTY_ADDRESS }])}
            >
              <PlusIcon width={14} height={14} />
              Add address
            </button>

            <h3 style={{ fontSize: 14, marginBottom: 8 }}>Employment history (last 5 years)</h3>
            {employment.map((row, i) => (
              <div className="repeater-row" key={i}>
                <div className="repeater-row-fields">
                  <div className="form-field" style={{ marginBottom: 0, flex: 1, minWidth: 160 }}>
                    <label>Employer</label>
                    <input
                      value={row.employer}
                      onChange={(e) =>
                        setEmployment((rows) => rows.map((r, idx) => (idx === i ? { ...r, employer: e.target.value } : r)))
                      }
                    />
                  </div>
                  <div className="form-field" style={{ marginBottom: 0, flex: 1, minWidth: 160 }}>
                    <label>Role</label>
                    <input
                      value={row.role}
                      onChange={(e) => setEmployment((rows) => rows.map((r, idx) => (idx === i ? { ...r, role: e.target.value } : r)))}
                    />
                  </div>
                  <div className="form-field" style={{ marginBottom: 0, minWidth: 130 }}>
                    <label>From</label>
                    <input
                      type="month"
                      value={row.from}
                      onChange={(e) => setEmployment((rows) => rows.map((r, idx) => (idx === i ? { ...r, from: e.target.value } : r)))}
                    />
                  </div>
                  <div className="form-field" style={{ marginBottom: 0, minWidth: 130 }}>
                    <label>To</label>
                    <input
                      type="month"
                      value={row.to}
                      onChange={(e) => setEmployment((rows) => rows.map((r, idx) => (idx === i ? { ...r, to: e.target.value } : r)))}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary repeater-remove"
                  aria-label="Remove employer"
                  onClick={() => setEmployment((rows) => rows.filter((_, idx) => idx !== i))}
                >
                  <TrashIcon width={14} height={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-secondary"
              style={{ marginBottom: 20 }}
              onClick={() => setEmployment((rows) => [...rows, { ...EMPTY_EMPLOYMENT }])}
            >
              <PlusIcon width={14} height={14} />
              Add employer
            </button>

            <h3 style={{ fontSize: 14, marginBottom: 8 }}>References</h3>
            {references.map((row, i) => (
              <div className="repeater-row" key={i}>
                <div className="repeater-row-fields">
                  <div className="form-field" style={{ marginBottom: 0, flex: 1, minWidth: 160 }}>
                    <label>Name</label>
                    <input
                      value={row.name}
                      onChange={(e) => setReferences((rows) => rows.map((r, idx) => (idx === i ? { ...r, name: e.target.value } : r)))}
                    />
                  </div>
                  <div className="form-field" style={{ marginBottom: 0, flex: 1, minWidth: 160 }}>
                    <label>Relationship</label>
                    <input
                      value={row.relationship}
                      onChange={(e) =>
                        setReferences((rows) => rows.map((r, idx) => (idx === i ? { ...r, relationship: e.target.value } : r)))
                      }
                    />
                  </div>
                  <div className="form-field" style={{ marginBottom: 0, flex: 1, minWidth: 160 }}>
                    <label>Contact</label>
                    <input
                      value={row.contact}
                      onChange={(e) => setReferences((rows) => rows.map((r, idx) => (idx === i ? { ...r, contact: e.target.value } : r)))}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary repeater-remove"
                  aria-label="Remove reference"
                  onClick={() => setReferences((rows) => rows.filter((_, idx) => idx !== i))}
                >
                  <TrashIcon width={14} height={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-secondary"
              style={{ marginBottom: 20 }}
              onClick={() => setReferences((rows) => [...rows, { ...EMPTY_REFERENCE }])}
            >
              <PlusIcon width={14} height={14} />
              Add reference
            </button>

            <label className="consent-box">
              <input type="checkbox" checked={consentGiven} onChange={(e) => setConsentGiven(e.target.checked)} />
              I consent to {status.organisationName} recording these details as part of BS7858-style pre-employment
              vetting.
            </label>

            <button className="btn btn-primary" type="submit" disabled={isSubmitting} style={{ marginTop: 12 }}>
              {isSubmitting ? "Submitting…" : "Submit for review"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
