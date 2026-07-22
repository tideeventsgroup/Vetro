import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { StatusBadge } from "../components/StatusBadge.js";
import { ArrowLeftIcon, DownloadIcon } from "../components/icons.js";
import { DbsLevel, Officer, ReferenceCheckStatus, useApi } from "../lib/api.js";
import { useTenantSlug } from "../lib/tenant.js";

const DBS_LEVEL_LABELS: Record<DbsLevel, string> = {
  BASIC: "Basic",
  STANDARD: "Standard",
  ENHANCED: "Enhanced",
};

const REFERENCE_CHECK_STATUS_LABELS: Record<ReferenceCheckStatus, string> = {
  PENDING: "Pending",
  RECEIVED: "Received",
  UNABLE_TO_CONTACT: "Unable to contact",
  FLAGGED: "Flagged",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
}

// A single-officer document pulling together every check Vetro tracks
// (SIA, BS7858, DBS, right to work, references) — the "one file to hand an
// ACS inspector or a client's due-diligence request" this org otherwise
// currently reconstructs by clicking through separate pages. Print-to-PDF
// rather than a server-generated file: no new backend dependency, and it's
// exactly what a browser's print dialog already does well.
export function ComplianceReport() {
  const { id } = useParams<{ id: string }>();
  const api = useApi();
  const tenant = useTenantSlug();
  const [officer, setOfficer] = useState<Officer | undefined>(undefined);

  useEffect(() => {
    if (id) void api.getOfficer(id).then(setOfficer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!officer) return <p style={{ color: "var(--vetro-text-muted)" }}>Loading…</p>;

  return (
    <div className="compliance-report">
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Link
          to={`/${tenant}/officers/${id}`}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--vetro-text-muted)" }}
        >
          <ArrowLeftIcon width={14} height={14} />
          Back to officer
        </Link>
        <button className="btn btn-primary" onClick={() => window.print()}>
          <DownloadIcon width={14} height={14} />
          Print / save as PDF
        </button>
      </div>

      <h1 style={{ marginBottom: 4 }}>Compliance report</h1>
      <p style={{ color: "var(--vetro-text-muted)", marginBottom: 24 }}>
        {officer.firstName} {officer.lastName} · Generated {formatDate(new Date().toISOString())}
      </p>

      <section className="card">
        <h2 style={{ marginBottom: 12 }}>SIA licences</h2>
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
      </section>

      <section className="card">
        <h2 style={{ marginBottom: 12 }}>BS7858 vetting</h2>
        {officer.vettingRecords.length === 0 ? (
          <p style={{ color: "var(--vetro-text-muted)", fontSize: 14 }}>No vetting on file.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Standard</th>
                <th>Completed</th>
                <th>Status</th>
                <th>Expires</th>
              </tr>
            </thead>
            <tbody>
              {officer.vettingRecords.map((v) => (
                <tr key={v.id}>
                  <td>{v.standard}</td>
                  <td>{formatDate(v.completedDate)}</td>
                  <td>
                    <StatusBadge status={v.status} />
                  </td>
                  <td>{formatDate(v.expiryDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h2 style={{ marginBottom: 12 }}>DBS checks</h2>
        {officer.dbsChecks.length === 0 ? (
          <p style={{ color: "var(--vetro-text-muted)", fontSize: 14 }}>No DBS checks on file.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Level</th>
                <th>Certificate</th>
                <th>Status</th>
                <th>Re-check due</th>
              </tr>
            </thead>
            <tbody>
              {officer.dbsChecks.map((d) => (
                <tr key={d.id}>
                  <td>{DBS_LEVEL_LABELS[d.level]}</td>
                  <td>{d.certificateNumber}</td>
                  <td>
                    <StatusBadge status={d.status} />
                  </td>
                  <td>{formatDate(d.expiryDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h2 style={{ marginBottom: 12 }}>Right to work</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Confirmed</th>
              <th>Checked on</th>
              <th>Document type</th>
              <th>Expiry</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{officer.rightToWorkConfirmed ? "Yes" : "No"}</td>
              <td>{formatDate(officer.rightToWorkCheckedAt)}</td>
              <td>{officer.rightToWorkDocumentType ?? "—"}</td>
              <td>{officer.rightToWorkExpiryDate ? formatDate(officer.rightToWorkExpiryDate) : "Ongoing"}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2 style={{ marginBottom: 12 }}>Reference checks</h2>
        {(officer.referenceChecks ?? []).length === 0 ? (
          <p style={{ color: "var(--vetro-text-muted)", fontSize: 14 }}>No reference checks on file.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Referee</th>
                <th>Contact</th>
                <th>Relationship</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(officer.referenceChecks ?? []).map((r) => (
                <tr key={r.id}>
                  <td>{r.refereeName}</td>
                  <td>{r.contact}</td>
                  <td>{r.relationship ?? "—"}</td>
                  <td>{REFERENCE_CHECK_STATUS_LABELS[r.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
