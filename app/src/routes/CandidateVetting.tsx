import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { StepIndicator } from "../components/StepIndicator.js";
import { PlusIcon, ShieldCheckIcon, TrashIcon } from "../components/icons.js";
import { PublicVettingInvite, useApi } from "../lib/api.js";

const WIZARD_STEPS = ["Addresses", "Employment", "References", "Review"];

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
  const [consentGiven, setConsentGiven] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [submitted, setSubmitted] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!token) return;
    api
      .getPublicVettingInvite(token)
      .then(setInvite)
      .catch((err) => setLoadError(err instanceof Error ? err.message : "This link is invalid or has expired"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function goNext() {
    setStep((s) => Math.min(s + 1, WIZARD_STEPS.length - 1));
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
      <div style={{ minHeight: "100vh", background: "var(--vetro-bg)", padding: "24px 16px" }}>
        <div className="card" style={{ maxWidth: 460, margin: "80px auto", textAlign: "center" }}>
          <span className="empty-icon">
            <ShieldCheckIcon />
          </span>
          <h2 style={{ fontSize: 18, margin: "8px 0" }}>Link unavailable</h2>
          <p style={{ color: "var(--vetro-text-muted)", fontSize: 14 }}>{loadError}</p>
        </div>
      </div>
    );
  }

  if (!invite) return <p style={{ color: "var(--vetro-text-muted)", textAlign: "center", marginTop: 80 }}>Loading…</p>;

  if (submitted || invite.status === "SUBMITTED") {
    return (
      <div style={{ minHeight: "100vh", background: "var(--vetro-bg)", padding: "24px 16px" }}>
        <div className="card" style={{ maxWidth: 460, margin: "80px auto", textAlign: "center" }}>
          <span className="empty-icon">
            <ShieldCheckIcon />
          </span>
          <h2 style={{ fontSize: 18, margin: "8px 0" }}>Thanks, {invite.firstName}</h2>
          <p style={{ color: "var(--vetro-text-muted)", fontSize: 14 }}>
            {invite.organisationName} has received your details and will be in touch once they've been reviewed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--vetro-bg)", padding: "24px 16px" }}>
      <div style={{ maxWidth: 640, margin: "40px auto" }}>
        <div className="page-header">
          <div>
            <h1>Vetting details</h1>
            <p>
              {invite.organisationName} has invited {invite.firstName} {invite.lastName} to complete BS7858-style
              pre-employment vetting before joining the roster.
            </p>
          </div>
        </div>

        <div className="card">
          {error && <p className="error-text">{error}</p>}

          <StepIndicator steps={WIZARD_STEPS} currentIndex={step} />
          <p className="step-caption">
            Step {step + 1} of {WIZARD_STEPS.length}: {WIZARD_STEPS[step]}
          </p>

          <div>
            {step === 0 && (
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

            {step === 1 && (
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

            {step === 2 && (
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

            {step === 3 && (
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
              {step < WIZARD_STEPS.length - 1 ? (
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
