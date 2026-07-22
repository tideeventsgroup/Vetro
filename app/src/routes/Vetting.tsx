import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { StatusBadge, SubmissionStatusBadge } from "../components/StatusBadge.js";
import { CheckIcon, ShieldCheckIcon, XIcon } from "../components/icons.js";
import { Officer, useApi, VettingSubmissionForReview } from "../lib/api.js";
import { worstDbsCheck, worstVettingRecord } from "../lib/status.js";
import { useTenantSlug } from "../lib/tenant.js";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
}

function listPreview(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return "—";
  return value
    .map((row) =>
      row && typeof row === "object" ? Object.values(row as Record<string, unknown>).filter(Boolean).join(", ") : String(row)
    )
    .join(" · ");
}

function referenceSummary(officer: Officer): string {
  const refs = officer.referenceChecks ?? [];
  if (refs.length === 0) return "—";
  if (refs.some((r) => r.status === "FLAGGED")) return "Flagged";
  if (refs.some((r) => r.status === "UNABLE_TO_CONTACT")) return "Unable to contact";
  if (refs.some((r) => r.status === "PENDING")) return "Pending";
  return "Received";
}

// This org still doesn't perform BS7858/DBS/RTW checks itself — this page
// is where that stays visible: a roster-wide view of every check Vetro
// tracks, plus the queue where an admin turns an officer's self-service
// submission (see routes/PortalHome.tsx) into the authoritative record.
export function Vetting() {
  const api = useApi();
  const tenant = useTenantSlug();
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [submissions, setSubmissions] = useState<VettingSubmissionForReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | undefined>(undefined);
  const [reviewNotes, setReviewNotes] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setIsLoading(true);
    try {
      const [officerRows, submissionRows] = await Promise.all([
        api.listOfficers(),
        api.listVettingSubmissionsForReview(),
      ]);
      setOfficers(officerRows);
      setSubmissions(submissionRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load vetting records");
    } finally {
      setIsLoading(false);
    }
  }

  function toggleExpand(id: string) {
    setExpandedId((current) => (current === id ? undefined : id));
    setReviewNotes("");
    setExpiryDate("");
    setError(undefined);
  }

  async function handleReview(id: string, status: "APPROVED" | "REJECTED") {
    setError(undefined);
    setIsSubmitting(true);
    try {
      await api.reviewVettingSubmission(id, {
        status,
        reviewNotes: reviewNotes.trim() || undefined,
        expiryDate: status === "APPROVED" ? expiryDate || undefined : undefined,
      });
      setExpandedId(undefined);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save review");
    } finally {
      setIsSubmitting(false);
    }
  }

  const pending = submissions.filter((s) => s.status === "PENDING_REVIEW");
  const reviewed = submissions.filter((s) => s.status !== "PENDING_REVIEW");

  if (isLoading) return <p style={{ color: "var(--vetro-text-muted)" }}>Loading…</p>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Vetting</h1>
          <p>BS7858, DBS, right to work and reference checks across your roster — plus submissions awaiting review.</p>
        </div>
      </div>

      {error && !expandedId && <p className="error-text">{error}</p>}

      <div className="card">
        <div className="card-header">
          <h2>Vetting records ({officers.length})</h2>
        </div>
        {officers.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">
              <ShieldCheckIcon />
            </span>
            <p>No officers added yet.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Officer</th>
                <th>BS7858</th>
                <th>DBS</th>
                <th>Right to work</th>
                <th>References</th>
              </tr>
            </thead>
            <tbody>
              {officers.map((o) => {
                const vetting = worstVettingRecord(o.vettingRecords);
                const dbs = worstDbsCheck(o.dbsChecks);
                return (
                  <tr key={o.id}>
                    <td>
                      <Link to={`/${tenant}/officers/${o.id}`}>
                        {o.firstName} {o.lastName}
                      </Link>
                    </td>
                    <td>{vetting ? <StatusBadge status={vetting.status} /> : "—"}</td>
                    <td>{dbs ? <StatusBadge status={dbs.status} /> : "—"}</td>
                    <td>
                      <span className={`status-badge ${o.rightToWorkConfirmed ? "status-active" : "status-expiring"}`}>
                        {o.rightToWorkConfirmed ? "Verified" : "Pending"}
                      </span>
                    </td>
                    <td>{referenceSummary(o)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {pending.length === 0 ? (
        <div className="card empty-state">
          <span className="empty-icon">
            <ShieldCheckIcon />
          </span>
          <p>Nothing waiting on you — all caught up.</p>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <h2>Pending review ({pending.length})</h2>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Officer</th>
                <th>Submitted</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pending.map((s) => (
                <Fragment key={s.id}>
                  <tr className="clickable" onClick={() => toggleExpand(s.id)}>
                    <td>
                      <Link to={`/${tenant}/officers/${s.officer.id}`} onClick={(e) => e.stopPropagation()}>
                        {s.officer.firstName} {s.officer.lastName}
                      </Link>
                    </td>
                    <td>{formatDate(s.submittedAt)}</td>
                    <td>
                      <SubmissionStatusBadge status={s.status} />
                    </td>
                  </tr>
                  {expandedId === s.id && (
                    <tr>
                      <td colSpan={3} style={{ background: "var(--vetro-bg)" }}>
                        <div style={{ padding: "12px 4px" }}>
                          <p style={{ fontSize: 13, marginBottom: 4 }}>
                            <strong>Address history:</strong> {listPreview(s.addressHistory)}
                          </p>
                          <p style={{ fontSize: 13, marginBottom: 4 }}>
                            <strong>Employment history:</strong> {listPreview(s.employmentHistory)}
                          </p>
                          <p style={{ fontSize: 13, marginBottom: 12 }}>
                            <strong>References:</strong> {listPreview(s.references)}
                          </p>

                          {error && <p className="error-text">{error}</p>}

                          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                            <div className="form-field" style={{ marginBottom: 0, minWidth: 160 }}>
                              <label htmlFor={`expiry-${s.id}`}>Vetting expiry (if approving)</label>
                              <input
                                id={`expiry-${s.id}`}
                                type="date"
                                value={expiryDate}
                                onChange={(e) => setExpiryDate(e.target.value)}
                              />
                            </div>
                            <div className="form-field" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}>
                              <label htmlFor={`notes-${s.id}`}>Notes (if rejecting)</label>
                              <input
                                id={`notes-${s.id}`}
                                value={reviewNotes}
                                onChange={(e) => setReviewNotes(e.target.value)}
                              />
                            </div>
                            <button
                              className="btn btn-primary"
                              disabled={isSubmitting}
                              onClick={() => handleReview(s.id, "APPROVED")}
                            >
                              <CheckIcon width={14} height={14} />
                              Approve
                            </button>
                            <button
                              className="btn btn-secondary"
                              disabled={isSubmitting}
                              onClick={() => handleReview(s.id, "REJECTED")}
                            >
                              <XIcon width={14} height={14} />
                              Reject
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reviewed.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2>Reviewed</h2>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Officer</th>
                <th>Submitted</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {reviewed.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link to={`/${tenant}/officers/${s.officer.id}`}>
                      {s.officer.firstName} {s.officer.lastName}
                    </Link>
                  </td>
                  <td>{formatDate(s.submittedAt)}</td>
                  <td>
                    <SubmissionStatusBadge status={s.status} />
                  </td>
                  <td>{s.reviewNotes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
