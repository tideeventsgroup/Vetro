import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ArrowLeftIcon } from "../components/icons.js";
import { CheckStatusBadge } from "../components/StatusBadge.js";
import { Candidate, Organisation, useApi } from "../lib/api.js";
import { checkTypeLabel, overallCheckState } from "../lib/status.js";

type ReportMode = "single" | "event";

const OVERALL_LABELS: Record<ReturnType<typeof overallCheckState>, string> = {
  verified: "Verified",
  pending: "Pending",
  rejected: "Rejected",
};

const OVERALL_CLASSES: Record<ReturnType<typeof overallCheckState>, string> = {
  verified: "status-active",
  pending: "status-pending",
  rejected: "status-expired",
};

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

/**
 * Printable compliance report — single candidate (route param :id, from
 * CandidateDetail.tsx's "Generate report") or every candidate in the org
 * (route /:tenant/report, from Dashboard.tsx's "Generate event report").
 * The toggle pill below lets an admin switch modes without leaving the
 * page — same fetched candidate list either way, just a different table.
 * "Print / save as PDF" is the actual export mechanism (see .compliance-report
 * print rules in styles/app.css), there's no separate PDF generation step.
 */
export function ComplianceReport() {
  const { id } = useParams<{ id: string }>();
  const api = useApi();
  const [organisation, setOrganisation] = useState<Organisation | undefined>(undefined);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [mode, setMode] = useState<ReportMode>(id ? "single" : "event");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setIsLoading(true);
    try {
      const [org, loaded] = await Promise.all([api.getCurrentOrganisation(), api.listCandidates()]);
      setOrganisation(org ?? undefined);
      setCandidates(loaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load compliance report");
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) return <p style={{ padding: 24, color: "var(--lunara-text-muted)" }}>Loading…</p>;

  const singleCandidate = candidates.find((c) => c.id === id) ?? candidates[0];

  return (
    <div className="compliance-report" style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <div className="no-print" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <button className="btn btn-secondary" onClick={() => window.close()}>
          <ArrowLeftIcon width={14} height={14} />
          Close
        </button>
        <div style={{ display: "flex", gap: 8, background: "var(--lunara-mist)", padding: 4, borderRadius: 999 }}>
          <button className={`report-mode-pill${mode === "single" ? " active" : ""}`} onClick={() => setMode("single")}>
            Single candidate
          </button>
          <button className={`report-mode-pill${mode === "event" ? " active" : ""}`} onClick={() => setMode("event")}>
            All candidates
          </button>
        </div>
        <button className="btn btn-dark" onClick={() => window.print()}>
          Print / export PDF
        </button>
      </div>

      <div className="card" style={{ padding: 48 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "2px solid var(--lunara-ink)", paddingBottom: 20, marginBottom: 28 }}>
          <img src="/brand/lunara-logo-primary.svg" alt="Lunara Screening" height="48" />
          <div style={{ textAlign: "right", fontSize: 12, color: "var(--lunara-text-muted)" }}>
            Generated {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            <br />
            by You
          </div>
        </div>

        {error && <p className="error-text">{error}</p>}

        {mode === "single" && singleCandidate && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
              <div>
                <div style={{ fontFamily: "var(--lunara-font-display)", fontWeight: 600, fontSize: 20 }}>
                  {singleCandidate.firstName} {singleCandidate.lastName}
                </div>
                <div style={{ fontSize: 13, color: "var(--lunara-text-muted)", marginTop: 4 }}>
                  {singleCandidate.roleType?.name ?? "No role type"} · {singleCandidate.email}
                </div>
              </div>
              <span className={`status-badge ${OVERALL_CLASSES[overallCheckState(singleCandidate)]}`} style={{ height: "fit-content" }}>
                {OVERALL_LABELS[overallCheckState(singleCandidate)]}
              </span>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Check</th>
                  <th>Status</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {singleCandidate.checks.map((check) => (
                  <tr key={check.id}>
                    <td>{checkTypeLabel(check.checkType)}</td>
                    <td>
                      <CheckStatusBadge status={check.status} />
                    </td>
                    <td style={{ fontSize: 12, color: "var(--lunara-text-muted)" }}>
                      {check.checkType === "DBS_CHECK"
                        ? "Pending partner integration"
                        : check.expiryDate
                        ? `Expires ${formatDate(check.expiryDate)}`
                        : check.notes ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {mode === "event" && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Role</th>
                <th>Overall status</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((candidate) => (
                <tr key={candidate.id}>
                  <td>
                    {candidate.firstName} {candidate.lastName}
                  </td>
                  <td style={{ fontSize: 13, color: "var(--lunara-text-secondary)" }}>{candidate.roleType?.name ?? "—"}</td>
                  <td>
                    <span className={`status-badge ${OVERALL_CLASSES[overallCheckState(candidate)]}`}>
                      {OVERALL_LABELS[overallCheckState(candidate)]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div style={{ marginTop: 36, paddingTop: 16, borderTop: "1px solid var(--lunara-border)", fontSize: 11, color: "var(--lunara-silver)" }}>
          This report reflects verification carried out via Lunara Screening. Checks marked as pending
          partner integration (PVG, Disclosure Scotland, DBS) are not yet performed via an accredited
          automated partner and reflect manual notes only.
        </div>
      </div>
    </div>
  );
}
