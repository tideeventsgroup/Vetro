import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { ArrowLeftIcon } from "../components/icons.js";
import { CandidateStatusBadge, CheckStatusBadge } from "../components/StatusBadge.js";
import { Candidate, Organisation, useApi } from "../lib/api.js";
import { checkTypeLabel } from "../lib/status.js";

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

function CandidateReport({ candidate }: { candidate: Candidate }) {
  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-header">
        <h2>
          {candidate.firstName} {candidate.lastName}
        </h2>
        <CandidateStatusBadge status={candidate.status} />
      </div>
      <p className="subtle-meta" style={{ marginBottom: 16 }}>
        {candidate.email} · {candidate.roleType?.name ?? "No role type"}
      </p>
      <table className="data-table">
        <thead>
          <tr>
            <th>Check</th>
            <th>Status</th>
            <th>Reference / expiry</th>
            <th>Verified</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {candidate.checks.map((check) => (
            <tr key={check.id}>
              <td>{checkTypeLabel(check.checkType)}</td>
              <td>
                <CheckStatusBadge status={check.status} />
              </td>
              <td>
                {check.licenceNumber && <div>{check.licenceNumber}</div>}
                {check.expiryDate && (
                  <div style={{ fontSize: 12, color: "var(--lunara-text-muted)" }}>Expires {formatDate(check.expiryDate)}</div>
                )}
                {!check.licenceNumber && !check.expiryDate && "—"}
              </td>
              <td>
                {check.verifiedAt ? (
                  <>
                    <div>{formatDate(check.verifiedAt)}</div>
                    <div style={{ fontSize: 12, color: "var(--lunara-text-muted)" }}>{check.verifiedBy}</div>
                  </>
                ) : (
                  "—"
                )}
              </td>
              <td>{check.notes ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Printable compliance report — single candidate (route param :id) or a
 * bulk export across a selected group (?ids=a,b,c from Dashboard.tsx's
 * checkbox selection). Same layout either way, just one card per candidate;
 * "Print / save as PDF" is the actual export mechanism (see .compliance-report
 * print rules in styles/app.css), there's no separate PDF generation step.
 */
export function ComplianceReport() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const api = useApi();
  const [organisation, setOrganisation] = useState<Organisation | undefined>(undefined);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const bulkIds = searchParams.get("ids")?.split(",").filter(Boolean) ?? [];
  const ids = id ? [id] : bulkIds;

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, searchParams.get("ids")]);

  async function load() {
    setIsLoading(true);
    try {
      const [org, loaded] = await Promise.all([api.getCurrentOrganisation(), Promise.all(ids.map((cid) => api.getCandidate(cid)))]);
      setOrganisation(org ?? undefined);
      setCandidates(loaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load compliance report");
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) return <p style={{ padding: 24, color: "var(--lunara-text-muted)" }}>Loading…</p>;

  return (
    <div className="compliance-report" style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <button className="btn btn-secondary" onClick={() => window.close()}>
          <ArrowLeftIcon width={14} height={14} />
          Close
        </button>
        <button className="btn btn-primary" onClick={() => window.print()}>
          Print / save as PDF
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <img src="/brand/lunara-logo-horizontal.svg" alt="Lunara Screening" height="32" />
      </div>

      <h1 style={{ marginBottom: 4 }}>Compliance report</h1>
      <p className="subtle-meta" style={{ marginBottom: 24 }}>
        {organisation?.name} · Generated {new Date().toLocaleString("en-GB")}
      </p>

      {error && <p className="error-text">{error}</p>}

      {candidates.map((candidate) => (
        <CandidateReport key={candidate.id} candidate={candidate} />
      ))}

      <p className="subtle-meta" style={{ marginTop: 24, borderTop: "1px solid var(--lunara-border)", paddingTop: 16 }}>
        Lunara Screening is not a DBS Registered Body or Umbrella Body. This report does not include and
        does not represent a DBS, PVG, or Disclosure Scotland check — those require an accredited partner
        and are not performed by this product today. Right to work checks tracked above are self-reported
        by the candidate and do not satisfy the statutory Home Office check, which remains a separate
        legal requirement.
      </p>
    </div>
  );
}
