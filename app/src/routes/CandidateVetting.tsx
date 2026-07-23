import { ChangeEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { StepIndicator } from "../components/StepIndicator.js";
import { CheckIcon, PlusIcon, ShieldCheckIcon, TrashIcon, UploadIcon } from "../components/icons.js";
import { DbsLevel, PublicVettingInvite, VettingInviteDocument, useApi } from "../lib/api.js";

const DBS_LEVEL_OPTIONS: DbsLevel[] = ["BASIC", "STANDARD", "ENHANCED"];

// Plain, human-readable strings — same convention OfficerDetail's own
// document upload already uses (see DocumentsSection.tsx's free-text
// "kind" field) — rather than an internal enum, so these show up exactly
// as-is in the officer's document list once the invite converts.
const DOC_KIND_ID = "Identity document";
const DOC_KIND_DBS = "DBS certificate";
const DOC_KIND_RTW = "Right to work document";

// The admin picks which checks apply to this role at invite time (see
// routes/Vetting.tsx's "Vetting workflow" checkboxes) — mirroring EBC
// Global's "screening under the appropriate vetting workflow" step — so the
// candidate only sees the sections that check actually needs. "Identity
// document" always appears — the baseline photo-ID upload EBC Global's own
// process collects for every candidate regardless of which other checks
// apply.
function buildSteps(requiresDbs: boolean, requiresRightToWork: boolean): string[] {
  const steps = ["Addresses", "Employment", "References", "Identity document"];
  if (requiresDbs) steps.push("DBS details");
  if (requiresRightToWork) steps.push("Right to work");
  steps.push("Review");
  return steps;
}

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

// A single presigned-upload slot, one per document kind — EBC Global's own
// process is built around collecting the actual document (a photo/scan),
// not just a self-reported certificate number, so this is what "look at how
// they take the information" turned into here.
function DocumentUploadField({
  kind,
  documents,
  uploadingKind,
  onUpload,
  onRemove,
}: {
  kind: string;
  documents: VettingInviteDocument[];
  uploadingKind: string | undefined;
  onUpload: (e: ChangeEvent<HTMLInputElement>, kind: string) => void;
  onRemove: (kind: string) => void;
}) {
  const doc = documents.find((d) => d.kind === kind);
  const isUploading = uploadingKind === kind;
  return (
    <div className="form-field">
      <label>{kind}</label>
      {doc ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            background: "var(--vetro-bg)",
            border: "1px solid var(--vetro-border)",
            borderRadius: 6,
          }}
        >
          <CheckIcon width={14} height={14} style={{ color: "var(--vetro-status-green-text)", flexShrink: 0 }} />
          <span style={{ fontSize: 13, flex: 1, wordBreak: "break-all" }}>{doc.fileName}</span>
          <button type="button" className="btn btn-secondary" onClick={() => onRemove(kind)}>
            <TrashIcon width={14} height={14} />
            Remove
          </button>
        </div>
      ) : (
        <label className="btn btn-secondary" style={{ display: "inline-flex", width: "fit-content", cursor: isUploading ? "default" : "pointer" }}>
          <UploadIcon width={14} height={14} />
          {isUploading ? "Uploading…" : "Upload file"}
          <input
            type="file"
            accept="image/*,application/pdf"
            style={{ display: "none" }}
            disabled={isUploading}
            onChange={(e) => onUpload(e, kind)}
          />
        </label>
      )}
    </div>
  );
}

// The candidate-facing counterpart to VettingWizard.tsx — reached via a
// one-off link (see routes/Vetting.tsx's "Invite a candidate" form) rather
// than a login, since this is filled in before an Officer record for this
// person even exists (see VettingInvite in prisma/schema.prisma). Not
// nested under /:tenant — the token in the URL is what resolves everything,
// the same way Kiosk.tsx works with no session.
export function CandidateVetting() {
  const { token } = useParams<{ token: string }>();
  const api = useApi();
  const [invite, setInvite] = useState<PublicVettingInvite | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | undefined>(undefined);
  const [addresses, setAddresses] = useState<AddressRow[]>([{ address: "", from: "", to: "" }]);
  const [employment, setEmployment] = useState<EmploymentRow[]>([{ employer: "", role: "", from: "", to: "" }]);
  const [references, setReferences] = useState<ReferenceRow[]>([{ name: "", relationship: "", contact: "" }]);
  const [dbsLevel, setDbsLevel] = useState<DbsLevel>("BASIC");
  const [dbsCertificateNumber, setDbsCertificateNumber] = useState("");
  const [dbsIssueDate, setDbsIssueDate] = useState("");
  const [rightToWorkConfirmed, setRightToWorkConfirmed] = useState(false);
  const [rightToWorkDocumentType, setRightToWorkDocumentType] = useState("");
  const [rightToWorkExpiryDate, setRightToWorkExpiryDate] = useState("");
  const [consentGiven, setConsentGiven] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [submitted, setSubmitted] = useState(false);
  const [step, setStep] = useState(0);
  const [documents, setDocuments] = useState<VettingInviteDocument[]>([]);
  const [uploadingKind, setUploadingKind] = useState<string | undefined>(undefined);
  const [uploadError, setUploadError] = useState<string | undefined>(undefined);

  const steps = buildSteps(invite?.requiresDbs ?? false, invite?.requiresRightToWork ?? false);

  useEffect(() => {
    if (!token) return;
    api
      .getPublicVettingInvite(token)
      .then((result) => {
        setInvite(result);
        setDocuments(result.documents);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "This link is invalid or has expired"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleUploadDocument(e: ChangeEvent<HTMLInputElement>, kind: string) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !token) return;
    setUploadError(undefined);
    setUploadingKind(kind);
    try {
      const doc = await api.uploadCandidateDocument(token, file, kind);
      setDocuments((docs) => [...docs.filter((d) => d.kind !== kind), doc]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Could not upload file");
    } finally {
      setUploadingKind(undefined);
    }
  }

  async function handleRemoveDocument(kind: string) {
    if (!token) return;
    const doc = documents.find((d) => d.kind === kind);
    if (!doc) return;
    try {
      await api.deleteCandidateDocument(token, doc.id);
      setDocuments((docs) => docs.filter((d) => d.id !== doc.id));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Could not remove file");
    }
  }

  function goNext() {
    setStep((s) => Math.min(s + 1, steps.length - 1));
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleSubmit() {
    if (!token) return;
    setError(undefined);
    if (!consentGiven) {
      setError("You must give consent before submitting.");
      return;
    }
    setIsSubmitting(true);
    try {
      await api.submitPublicVettingInvite(token, {
        addressHistory: addresses.filter((a) => a.address.trim()),
        employmentHistory: employment.filter((e2) => e2.employer.trim()),
        references: references.filter((r) => r.name.trim()),
        consentGiven,
        ...(invite?.requiresDbs
          ? { dbsLevel, dbsCertificateNumber: dbsCertificateNumber.trim(), dbsIssueDate: dbsIssueDate || undefined }
          : {}),
        ...(invite?.requiresRightToWork
          ? {
              rightToWorkConfirmed,
              rightToWorkDocumentType: rightToWorkDocumentType.trim() || undefined,
              rightToWorkExpiryDate: rightToWorkExpiryDate || undefined,
            }
          : {}),
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit your details");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <div className="candidate-vetting-shell">
        <div className="candidate-vetting-topbar">
          <img src="/brand/vetro-logo-horizontal-dark.svg" alt="Vetro" height="24" />
        </div>
        <div className="candidate-vetting-state">
          <div className="candidate-vetting-state-card">
            <span className="empty-icon">
              <ShieldCheckIcon />
            </span>
            <h2 style={{ fontSize: 18, margin: "8px 0" }}>Link unavailable</h2>
            <p style={{ color: "var(--vetro-text-muted)", fontSize: 14 }}>{loadError}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="candidate-vetting-shell">
        <div className="candidate-vetting-topbar">
          <img src="/brand/vetro-logo-horizontal-dark.svg" alt="Vetro" height="24" />
        </div>
        <p style={{ color: "var(--vetro-text-muted)", textAlign: "center", marginTop: 80 }}>Loading…</p>
      </div>
    );
  }

  if (submitted || invite.status === "SUBMITTED") {
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
            <h2 style={{ fontSize: 18, margin: "8px 0" }}>Thanks, {invite.firstName}</h2>
            <p style={{ color: "var(--vetro-text-muted)", fontSize: 14 }}>
              {invite.organisationName} has received your details and will be in touch once they've been reviewed.
            </p>
          </div>
        </div>
      </div>
    );
  }

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
            <h1>Hi {invite.firstName}, let's get you vetted</h1>
            <p>
              {invite.organisationName} has invited you to complete BS7858-style pre-employment vetting before
              joining the roster. It only takes a few minutes — you can come back to this link any time before you
              submit.
            </p>
          </div>
        </div>

        <div className="card">
          {error && <p className="error-text">{error}</p>}

          <StepIndicator steps={steps} currentIndex={step} />
          <p className="step-caption">
            Step {step + 1} of {steps.length}: {steps[step]}
          </p>

          <div>
            {steps[step] === "Addresses" && (
              <>
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
                          onChange={(e) =>
                            setAddresses((rows) => rows.map((r, idx) => (idx === i ? { ...r, from: e.target.value } : r)))
                          }
                        />
                      </div>
                      <div className="form-field" style={{ marginBottom: 0, minWidth: 130 }}>
                        <label>To</label>
                        <input
                          type="month"
                          value={row.to}
                          onChange={(e) =>
                            setAddresses((rows) => rows.map((r, idx) => (idx === i ? { ...r, to: e.target.value } : r)))
                          }
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
                  onClick={() => setAddresses((rows) => [...rows, { address: "", from: "", to: "" }])}
                >
                  <PlusIcon width={14} height={14} />
                  Add address
                </button>
              </>
            )}

            {steps[step] === "Employment" && (
              <>
                <h3 style={{ fontSize: 14, marginBottom: 8 }}>Employment history (last 5 years)</h3>
                {employment.map((row, i) => (
                  <div className="repeater-row" key={i}>
                    <div className="repeater-row-fields">
                      <div className="form-field" style={{ marginBottom: 0, flex: 1, minWidth: 160 }}>
                        <label>Employer</label>
                        <input
                          value={row.employer}
                          onChange={(e) =>
                            setEmployment((rows) =>
                              rows.map((r, idx) => (idx === i ? { ...r, employer: e.target.value } : r))
                            )
                          }
                        />
                      </div>
                      <div className="form-field" style={{ marginBottom: 0, flex: 1, minWidth: 160 }}>
                        <label>Role</label>
                        <input
                          value={row.role}
                          onChange={(e) =>
                            setEmployment((rows) => rows.map((r, idx) => (idx === i ? { ...r, role: e.target.value } : r)))
                          }
                        />
                      </div>
                      <div className="form-field" style={{ marginBottom: 0, minWidth: 130 }}>
                        <label>From</label>
                        <input
                          type="month"
                          value={row.from}
                          onChange={(e) =>
                            setEmployment((rows) => rows.map((r, idx) => (idx === i ? { ...r, from: e.target.value } : r)))
                          }
                        />
                      </div>
                      <div className="form-field" style={{ marginBottom: 0, minWidth: 130 }}>
                        <label>To</label>
                        <input
                          type="month"
                          value={row.to}
                          onChange={(e) =>
                            setEmployment((rows) => rows.map((r, idx) => (idx === i ? { ...r, to: e.target.value } : r)))
                          }
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
                  onClick={() => setEmployment((rows) => [...rows, { employer: "", role: "", from: "", to: "" }])}
                >
                  <PlusIcon width={14} height={14} />
                  Add employer
                </button>
              </>
            )}

            {steps[step] === "References" && (
              <>
                <h3 style={{ fontSize: 14, marginBottom: 8 }}>References</h3>
                {references.map((row, i) => (
                  <div className="repeater-row" key={i}>
                    <div className="repeater-row-fields">
                      <div className="form-field" style={{ marginBottom: 0, flex: 1, minWidth: 160 }}>
                        <label>Name</label>
                        <input
                          value={row.name}
                          onChange={(e) =>
                            setReferences((rows) => rows.map((r, idx) => (idx === i ? { ...r, name: e.target.value } : r)))
                          }
                        />
                      </div>
                      <div className="form-field" style={{ marginBottom: 0, flex: 1, minWidth: 160 }}>
                        <label>Relationship</label>
                        <input
                          value={row.relationship}
                          onChange={(e) =>
                            setReferences((rows) =>
                              rows.map((r, idx) => (idx === i ? { ...r, relationship: e.target.value } : r))
                            )
                          }
                        />
                      </div>
                      <div className="form-field" style={{ marginBottom: 0, flex: 1, minWidth: 160 }}>
                        <label>Contact</label>
                        <input
                          value={row.contact}
                          onChange={(e) =>
                            setReferences((rows) =>
                              rows.map((r, idx) => (idx === i ? { ...r, contact: e.target.value } : r))
                            )
                          }
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
                  onClick={() => setReferences((rows) => [...rows, { name: "", relationship: "", contact: "" }])}
                >
                  <PlusIcon width={14} height={14} />
                  Add reference
                </button>
              </>
            )}

            {steps[step] === "Identity document" && (
              <>
                <h3 style={{ fontSize: 14, marginBottom: 8 }}>Identity document</h3>
                <p style={{ fontSize: 13, color: "var(--vetro-text-muted)", marginBottom: 12 }}>
                  Upload a photo or scan of your passport, driving licence, or other photo ID.
                </p>
                {uploadError && <p className="error-text">{uploadError}</p>}
                <DocumentUploadField
                  kind={DOC_KIND_ID}
                  documents={documents}
                  uploadingKind={uploadingKind}
                  onUpload={handleUploadDocument}
                  onRemove={handleRemoveDocument}
                />
              </>
            )}

            {steps[step] === "DBS details" && (
              <>
                <h3 style={{ fontSize: 14, marginBottom: 8 }}>DBS check</h3>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <div className="form-field" style={{ minWidth: 160, flex: 1 }}>
                    <label htmlFor="dbsLevel">Level</label>
                    <select id="dbsLevel" value={dbsLevel} onChange={(e) => setDbsLevel(e.target.value as DbsLevel)}>
                      {DBS_LEVEL_OPTIONS.map((level) => (
                        <option key={level} value={level}>
                          {level.charAt(0) + level.slice(1).toLowerCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-field" style={{ minWidth: 200, flex: 1 }}>
                    <label htmlFor="dbsCertificateNumber">Certificate number</label>
                    <input
                      id="dbsCertificateNumber"
                      value={dbsCertificateNumber}
                      onChange={(e) => setDbsCertificateNumber(e.target.value)}
                    />
                  </div>
                  <div className="form-field" style={{ minWidth: 160, flex: 1 }}>
                    <label htmlFor="dbsIssueDate">Issue date</label>
                    <input
                      id="dbsIssueDate"
                      type="date"
                      value={dbsIssueDate}
                      onChange={(e) => setDbsIssueDate(e.target.value)}
                    />
                  </div>
                </div>
                {uploadError && <p className="error-text">{uploadError}</p>}
                <DocumentUploadField
                  kind={DOC_KIND_DBS}
                  documents={documents}
                  uploadingKind={uploadingKind}
                  onUpload={handleUploadDocument}
                  onRemove={handleRemoveDocument}
                />
              </>
            )}

            {steps[step] === "Right to work" && (
              <>
                <h3 style={{ fontSize: 14, marginBottom: 8 }}>Right to work</h3>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, marginBottom: 12 }}>
                  <input
                    type="checkbox"
                    checked={rightToWorkConfirmed}
                    onChange={(e) => setRightToWorkConfirmed(e.target.checked)}
                  />
                  I confirm I have the right to work in the UK.
                </label>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <div className="form-field" style={{ minWidth: 200, flex: 1 }}>
                    <label htmlFor="rtwDocumentType">Document type</label>
                    <input
                      id="rtwDocumentType"
                      placeholder="e.g. Passport, BRP, share code"
                      value={rightToWorkDocumentType}
                      onChange={(e) => setRightToWorkDocumentType(e.target.value)}
                    />
                  </div>
                  <div className="form-field" style={{ minWidth: 160, flex: 1 }}>
                    <label htmlFor="rtwExpiryDate">Expiry (blank = ongoing)</label>
                    <input
                      id="rtwExpiryDate"
                      type="date"
                      value={rightToWorkExpiryDate}
                      onChange={(e) => setRightToWorkExpiryDate(e.target.value)}
                    />
                  </div>
                </div>
                {uploadError && <p className="error-text">{uploadError}</p>}
                <DocumentUploadField
                  kind={DOC_KIND_RTW}
                  documents={documents}
                  uploadingKind={uploadingKind}
                  onUpload={handleUploadDocument}
                  onRemove={handleRemoveDocument}
                />
              </>
            )}

            {steps[step] === "Review" && (
              <>
                <div className="review-summary">
                  <div className="review-summary-group">
                    <h4>Addresses</h4>
                    {addresses.filter((a) => a.address.trim()).length === 0 ? (
                      <p className="subtle-meta">None entered.</p>
                    ) : (
                      addresses
                        .filter((a) => a.address.trim())
                        .map((a, i) => (
                          <div className="review-summary-row" key={i}>
                            <strong>{a.address}</strong> — {a.from || "?"} to {a.to || "present"}
                          </div>
                        ))
                    )}
                  </div>
                  <div className="review-summary-group">
                    <h4>Employment</h4>
                    {employment.filter((e2) => e2.employer.trim()).length === 0 ? (
                      <p className="subtle-meta">None entered.</p>
                    ) : (
                      employment
                        .filter((e2) => e2.employer.trim())
                        .map((e2, i) => (
                          <div className="review-summary-row" key={i}>
                            <strong>{e2.employer}</strong>
                            {e2.role ? ` — ${e2.role}` : ""} ({e2.from || "?"} to {e2.to || "present"})
                          </div>
                        ))
                    )}
                  </div>
                  <div className="review-summary-group">
                    <h4>References</h4>
                    {references.filter((r) => r.name.trim()).length === 0 ? (
                      <p className="subtle-meta">None entered.</p>
                    ) : (
                      references
                        .filter((r) => r.name.trim())
                        .map((r, i) => (
                          <div className="review-summary-row" key={i}>
                            <strong>{r.name}</strong>
                            {r.relationship ? ` — ${r.relationship}` : ""}
                            {r.contact ? ` (${r.contact})` : ""}
                          </div>
                        ))
                    )}
                  </div>
                  {invite.requiresDbs && (
                    <div className="review-summary-group">
                      <h4>DBS check</h4>
                      <div className="review-summary-row">
                        {dbsCertificateNumber.trim() ? (
                          <>
                            <strong>{dbsLevel}</strong> — certificate {dbsCertificateNumber}
                            {dbsIssueDate ? ` (issued ${dbsIssueDate})` : ""}
                          </>
                        ) : (
                          <span className="subtle-meta">None entered.</span>
                        )}
                      </div>
                    </div>
                  )}
                  {invite.requiresRightToWork && (
                    <div className="review-summary-group">
                      <h4>Right to work</h4>
                      <div className="review-summary-row">
                        {rightToWorkConfirmed ? "Confirmed" : "Not confirmed"}
                        {rightToWorkDocumentType ? ` — ${rightToWorkDocumentType}` : ""}
                        {rightToWorkExpiryDate ? `, expires ${rightToWorkExpiryDate}` : ""}
                      </div>
                    </div>
                  )}
                  <div className="review-summary-group">
                    <h4>Documents</h4>
                    {documents.length === 0 ? (
                      <p className="subtle-meta">None uploaded.</p>
                    ) : (
                      documents.map((d) => (
                        <div className="review-summary-row" key={d.id}>
                          {d.kind}: <strong>{d.fileName}</strong>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <label className="consent-box">
                  <input type="checkbox" checked={consentGiven} onChange={(e) => setConsentGiven(e.target.checked)} />
                  I consent to {invite.organisationName} recording these details as part of BS7858-style pre-employment
                  vetting.
                </label>
              </>
            )}

            <div className="wizard-nav">
              {step > 0 ? (
                <button type="button" className="btn btn-secondary" onClick={goBack}>
                  Back
                </button>
              ) : (
                <span />
              )}
              {step < steps.length - 1 ? (
                <button type="button" className="btn btn-primary" onClick={goNext}>
                  Next
                </button>
              ) : (
                <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? "Submitting…" : "Submit"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
