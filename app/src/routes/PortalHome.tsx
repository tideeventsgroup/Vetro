import { FormEvent, useEffect, useMemo, useState } from "react";
import { DocumentsSection } from "../components/DocumentsSection.js";
import { StatusBadge, SubmissionStatusBadge } from "../components/StatusBadge.js";
import { PlusIcon, ShieldCheckIcon, TrashIcon } from "../components/icons.js";
import { Officer, useApi } from "../lib/api.js";
import { worstStatus } from "../lib/status.js";

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

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
}

// Vetro never performs the BS7858 check itself — this is what an officer
// submits for their own admin to review before it becomes (or updates) the
// authoritative VettingRecord (see backend/prisma/schema.prisma).
export function PortalHome() {
  const api = useApi();
  const [officer, setOfficer] = useState<Officer | undefined>(undefined);
  const [addresses, setAddresses] = useState<AddressRow[]>([{ address: "", from: "", to: "" }]);
  const [employment, setEmployment] = useState<EmploymentRow[]>([{ employer: "", role: "", from: "", to: "" }]);
  const [references, setReferences] = useState<ReferenceRow[]>([{ name: "", relationship: "", contact: "" }]);
  const [consentGiven, setConsentGiven] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [submitted, setSubmitted] = useState(false);

  const latestSubmission = useMemo(() => {
    const submissions = officer?.vettingSubmissions ?? [];
    if (submissions.length === 0) return undefined;
    return [...submissions].sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    )[0];
  }, [officer]);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setOfficer(await api.getMyOfficer());
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    if (!consentGiven) {
      setError("You must give consent before submitting.");
      return;
    }
    setIsSubmitting(true);
    try {
      await api.submitVetting({
        addressHistory: addresses.filter((a) => a.address.trim()),
        employmentHistory: employment.filter((e2) => e2.employer.trim()),
        references: references.filter((r) => r.name.trim()),
        consentGiven,
      });
      setSubmitted(true);
      setAddresses([{ address: "", from: "", to: "" }]);
      setEmployment([{ employer: "", role: "", from: "", to: "" }]);
      setReferences([{ name: "", relationship: "", contact: "" }]);
      setConsentGiven(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit vetting details");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!officer) return <p style={{ color: "var(--vetro-text-muted)" }}>Loading…</p>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>
            {officer.firstName} {officer.lastName}
          </h1>
          <p>Your own record — submit your vetting details and documents for review.</p>
        </div>
      </div>

      <div className="summary-grid">
        <div className="summary-tile">
          <div>
            <div className="label" style={{ marginBottom: 6 }}>
              Overall status
            </div>
            <StatusBadge status={worstStatus(officer)} />
          </div>
        </div>
        <div className="summary-tile">
          <div>
            <div className="count">{officer.licences.length}</div>
            <div className="label">Licences on file</div>
          </div>
        </div>
        <div className="summary-tile">
          <div>
            <div className="label" style={{ marginBottom: 6 }}>
              Latest vetting submission
            </div>
            {latestSubmission ? (
              <SubmissionStatusBadge status={latestSubmission.status} />
            ) : (
              <span className="subtle-meta" style={{ margin: 0 }}>
                Not submitted yet
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>SIA licences</h2>
        </div>
        {officer.licences.length === 0 ? (
          <p style={{ color: "var(--vetro-text-muted)", fontSize: 14 }}>No licences on file.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Sector</th>
                <th>Reference</th>
                <th>Status</th>
                <th>Expires</th>
              </tr>
            </thead>
            <tbody>
              {officer.licences.map((l) => (
                <tr key={l.id}>
                  <td>{l.sector}</td>
                  <td>{l.licenceNumber}</td>
                  <td>
                    <StatusBadge status={l.status} />
                  </td>
                  <td>{formatDate(l.expiryDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Vetting submissions</h2>
        </div>
        <p style={{ color: "var(--vetro-text-muted)", fontSize: 14, marginBottom: 12 }}>
          Vetro tracks your BS7858 status — it doesn't carry out the check itself. Submit your details below
          and your admin will review them.
        </p>
        {(officer.vettingSubmissions ?? []).length === 0 ? (
          <p style={{ color: "var(--vetro-text-muted)", fontSize: 14 }}>No submissions yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Submitted</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {(officer.vettingSubmissions ?? []).map((s) => (
                <tr key={s.id}>
                  <td>{formatDate(s.submittedAt)}</td>
                  <td>
                    <SubmissionStatusBadge status={s.status} />
                  </td>
                  <td>{s.reviewNotes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Submit vetting details</h2>
        </div>

        {submitted && (
          <p className="subtle-meta" style={{ marginBottom: 12 }}>
            <ShieldCheckIcon width={14} height={14} /> Submitted — your admin will review it shortly.
          </p>
        )}
        {error && <p className="error-text">{error}</p>}

        <form onSubmit={handleSubmit}>
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

          <label className="consent-box">
            <input
              type="checkbox"
              checked={consentGiven}
              onChange={(e) => setConsentGiven(e.target.checked)}
            />
            I consent to Vetro recording these details for my employer to review as part of BS7858 vetting.
          </label>

          <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Submitting…" : "Submit for review"}
          </button>
        </form>
      </div>

      <DocumentsSection
        documents={officer.documents ?? []}
        onUpload={(file, kind) => api.uploadMyDocument(file, kind)}
        onGetDownloadUrl={(id) => api.getMyDocumentDownloadUrl(id)}
        onChange={load}
      />
    </div>
  );
}
