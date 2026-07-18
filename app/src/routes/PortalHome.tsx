import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DocumentsSection } from "../components/DocumentsSection.js";
import { StatusBadge, SubmissionStatusBadge } from "../components/StatusBadge.js";
import { ShieldCheckIcon } from "../components/icons.js";
import { Officer, useApi } from "../lib/api.js";
import { useTenantSlug } from "../lib/tenant.js";
import { worstStatus } from "../lib/status.js";

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
}

// The officer's own overview — status, licences, and vetting submission
// history at a glance. Submitting/updating vetting details is its own page
// (VettingWizard.tsx, at .../portal/vetting) rather than a card here, since
// it's a multi-step task an officer comes back to, not something to scroll
// past on the way to checking their status.
export function PortalHome() {
  const api = useApi();
  const tenant = useTenantSlug();
  const [officer, setOfficer] = useState<Officer | undefined>(undefined);

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

  if (!officer) return <p style={{ color: "var(--vetro-text-muted)" }}>Loading…</p>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>
            {officer.firstName} {officer.lastName}
          </h1>
          <p>Your own record — licences, vetting status, and documents.</p>
        </div>
      </div>

      {!latestSubmission && (
        <div className="welcome-banner">
          <span className="welcome-banner-icon">
            <ShieldCheckIcon />
          </span>
          <div className="welcome-banner-text">
            <h3>Welcome, {officer.firstName}!</h3>
            <p>You're not onboarded yet — complete your vetting now to finish setting up your record.</p>
          </div>
          <div className="welcome-banner-actions">
            <Link to={`/${tenant}/portal/vetting`} className="btn btn-primary">
              Complete vetting now
            </Link>
          </div>
        </div>
      )}

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
          <Link to={`/${tenant}/portal/vetting`} className="btn btn-secondary">
            <ShieldCheckIcon width={14} height={14} />
            {latestSubmission ? "Submit an update" : "Submit vetting details"}
          </Link>
        </div>
        <p style={{ color: "var(--vetro-text-muted)", fontSize: 14, marginBottom: 12 }}>
          Vetro tracks your BS7858 status — it doesn't carry out the check itself. Your admin reviews what
          you submit.
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

      <DocumentsSection
        documents={officer.documents ?? []}
        onUpload={(file, kind) => api.uploadMyDocument(file, kind)}
        onGetDownloadUrl={(id) => api.getMyDocumentDownloadUrl(id)}
        onChange={load}
      />
    </div>
  );
}
