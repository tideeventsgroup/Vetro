import { Fragment, FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ComplianceGapPanel } from "../components/ComplianceGapPanel.js";
import { StatusBadge, SubmissionStatusBadge, VettingInviteStatusBadge } from "../components/StatusBadge.js";
import { CheckIcon, MailIcon, ShieldCheckIcon, TrashIcon, XIcon } from "../components/icons.js";
import { Officer, useApi, VettingInvite, VettingSubmissionForReview } from "../lib/api.js";
import { worstDbsCheck, worstVettingRecord } from "../lib/status.js";
import { useTenantSlug } from "../lib/tenant.js";

const EMPTY_INVITE_FORM = { firstName: "", lastName: "", email: "", phone: "", requiresDbs: false, requiresRightToWork: false };

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
  const [invites, setInvites] = useState<VettingInvite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | undefined>(undefined);
  const [reviewNotes, setReviewNotes] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [inviteForm, setInviteForm] = useState(EMPTY_INVITE_FORM);
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | undefined>(undefined);
  const [newInviteLink, setNewInviteLink] = useState<string | undefined>(undefined);
  const [linkCopied, setLinkCopied] = useState(false);
  const [expandedInviteId, setExpandedInviteId] = useState<string | undefined>(undefined);
  const [isConverting, setIsConverting] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setIsLoading(true);
    try {
      const [officerRows, submissionRows, inviteRows] = await Promise.all([
        api.listOfficers(),
        api.listVettingSubmissionsForReview(),
        api.listVettingInvites(),
      ]);
      setOfficers(officerRows);
      setSubmissions(submissionRows);
      setInvites(inviteRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load vetting records");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    setInviteError(undefined);
    setIsInviting(true);
    try {
      const created = await api.createVettingInvite({
        firstName: inviteForm.firstName.trim(),
        lastName: inviteForm.lastName.trim(),
        email: inviteForm.email.trim(),
        phone: inviteForm.phone.trim() || undefined,
        requiresDbs: inviteForm.requiresDbs,
        requiresRightToWork: inviteForm.requiresRightToWork,
      });
      setNewInviteLink(`${window.location.origin}/candidate-vetting/${created.token}`);
      setLinkCopied(false);
      setInviteForm(EMPTY_INVITE_FORM);
      await load();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Could not send the invite");
    } finally {
      setIsInviting(false);
    }
  }

  async function handleCopyLink() {
    if (!newInviteLink) return;
    await navigator.clipboard.writeText(newInviteLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  function toggleExpandInvite(id: string) {
    setExpandedInviteId((current) => (current === id ? undefined : id));
  }

  async function handleConvert(id: string) {
    setError(undefined);
    setIsConverting(true);
    try {
      await api.convertVettingInvite(id);
      setExpandedInviteId(undefined);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add this candidate to the roster");
    } finally {
      setIsConverting(false);
    }
  }

  async function handleViewDocument(inviteId: string, documentId: string) {
    try {
      const url = await api.getVettingInviteDocumentDownloadUrl(inviteId, documentId);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open this document");
    }
  }

  async function handleRevoke(id: string) {
    if (!window.confirm("Revoke this invite? The link will stop working.")) return;
    setIsRevoking(true);
    try {
      await api.revokeVettingInvite(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not revoke this invite");
    } finally {
      setIsRevoking(false);
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
          <p>
            Invite candidates to complete vetting before they join the roster, then review BS7858, DBS, right to work
            and reference checks across everyone already on it.
          </p>
        </div>
      </div>

      {error && !expandedId && <p className="error-text">{error}</p>}

      <div className="card" style={{ maxWidth: 560 }}>
        <span className="empty-icon" style={{ background: "var(--vetro-teal-light)", color: "var(--vetro-teal-dark)" }}>
          <MailIcon />
        </span>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Invite a candidate</h2>
        <p style={{ color: "var(--vetro-text-muted)", fontSize: 14, marginBottom: 16 }}>
          Send a link so someone can complete BS7858-style vetting before they're added to the roster at all.
        </p>
        <form onSubmit={handleInvite}>
          {inviteError && <p className="error-text">{inviteError}</p>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div className="form-field" style={{ minWidth: 160, flex: 1 }}>
              <label htmlFor="inviteFirstName">First name</label>
              <input
                id="inviteFirstName"
                required
                value={inviteForm.firstName}
                onChange={(e) => setInviteForm((f) => ({ ...f, firstName: e.target.value }))}
              />
            </div>
            <div className="form-field" style={{ minWidth: 160, flex: 1 }}>
              <label htmlFor="inviteLastName">Last name</label>
              <input
                id="inviteLastName"
                required
                value={inviteForm.lastName}
                onChange={(e) => setInviteForm((f) => ({ ...f, lastName: e.target.value }))}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div className="form-field" style={{ minWidth: 200, flex: 1 }}>
              <label htmlFor="inviteEmail">Email</label>
              <input
                id="inviteEmail"
                type="email"
                required
                value={inviteForm.email}
                onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="form-field" style={{ minWidth: 160, flex: 1 }}>
              <label htmlFor="invitePhone">Phone (optional)</label>
              <input
                id="invitePhone"
                value={inviteForm.phone}
                onChange={(e) => setInviteForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: "var(--vetro-text-secondary)" }}>
              Vetting workflow — also collect:
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, marginBottom: 4 }}>
              <input
                type="checkbox"
                checked={inviteForm.requiresDbs}
                onChange={(e) => setInviteForm((f) => ({ ...f, requiresDbs: e.target.checked }))}
              />
              DBS check details
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={inviteForm.requiresRightToWork}
                onChange={(e) => setInviteForm((f) => ({ ...f, requiresRightToWork: e.target.checked }))}
              />
              Right to work
            </label>
          </div>
          <button className="btn btn-primary" type="submit" disabled={isInviting}>
            <MailIcon width={14} height={14} />
            {isInviting ? "Sending…" : "Send invite"}
          </button>
        </form>
        {newInviteLink && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 12,
              padding: "8px 12px",
              background: "var(--vetro-bg)",
              border: "1px solid var(--vetro-border)",
              borderRadius: 6,
            }}
          >
            <code style={{ fontSize: 13, flex: 1, wordBreak: "break-all" }}>{newInviteLink}</code>
            <button type="button" className="btn btn-secondary" onClick={handleCopyLink}>
              {linkCopied ? "Copied" : "Copy"}
            </button>
          </div>
        )}
      </div>

      {invites.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2>Candidates ({invites.length})</h2>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Checks requested</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invites.map((invite) => (
                <Fragment key={invite.id}>
                  <tr
                    className={invite.status === "SUBMITTED" ? "clickable" : ""}
                    onClick={() => invite.status === "SUBMITTED" && toggleExpandInvite(invite.id)}
                  >
                    <td>
                      {invite.status === "CONVERTED" && invite.convertedOfficerId ? (
                        <Link to={`/${tenant}/officers/${invite.convertedOfficerId}`} onClick={(e) => e.stopPropagation()}>
                          {invite.firstName} {invite.lastName}
                        </Link>
                      ) : (
                        `${invite.firstName} ${invite.lastName}`
                      )}
                    </td>
                    <td>{invite.email}</td>
                    <td style={{ fontSize: 13, color: "var(--vetro-text-muted)" }}>
                      BS7858
                      {invite.requiresDbs ? ", DBS" : ""}
                      {invite.requiresRightToWork ? ", Right to work" : ""}
                    </td>
                    <td>
                      <VettingInviteStatusBadge status={invite.status} />
                    </td>
                    <td>
                      {invite.status === "PENDING" && (
                        <button
                          className="btn btn-secondary"
                          disabled={isRevoking}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleRevoke(invite.id);
                          }}
                        >
                          <TrashIcon width={14} height={14} />
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedInviteId === invite.id && (
                    <tr>
                      <td colSpan={5} style={{ background: "var(--vetro-bg)" }}>
                        <div style={{ padding: "12px 4px" }}>
                          <p style={{ fontSize: 13, marginBottom: 4 }}>
                            <strong>Address history:</strong> {listPreview(invite.addressHistory)}
                          </p>
                          <p style={{ fontSize: 13, marginBottom: 4 }}>
                            <strong>Employment history:</strong> {listPreview(invite.employmentHistory)}
                          </p>
                          <p style={{ fontSize: 13, marginBottom: invite.requiresDbs || invite.requiresRightToWork ? 4 : 12 }}>
                            <strong>References:</strong> {listPreview(invite.references)}
                          </p>
                          {invite.requiresDbs && (
                            <p style={{ fontSize: 13, marginBottom: 4 }}>
                              <strong>DBS:</strong>{" "}
                              {invite.dbsCertificateNumber
                                ? `${invite.dbsLevel} — certificate ${invite.dbsCertificateNumber}${invite.dbsIssueDate ? ` (issued ${formatDate(invite.dbsIssueDate)})` : ""}`
                                : "Not provided"}
                            </p>
                          )}
                          {invite.requiresRightToWork && (
                            <p style={{ fontSize: 13, marginBottom: 4 }}>
                              <strong>Right to work:</strong>{" "}
                              {invite.rightToWorkConfirmed ? "Confirmed" : "Not confirmed"}
                              {invite.rightToWorkDocumentType ? ` — ${invite.rightToWorkDocumentType}` : ""}
                              {invite.rightToWorkExpiryDate ? `, expires ${formatDate(invite.rightToWorkExpiryDate)}` : ""}
                            </p>
                          )}
                          <p style={{ fontSize: 13, marginBottom: 12 }}>
                            <strong>Documents:</strong>{" "}
                            {invite.documents.length === 0 ? (
                              "None uploaded"
                            ) : (
                              invite.documents.map((doc, i) => (
                                <span key={doc.id}>
                                  {i > 0 && ", "}
                                  {doc.kind}{" "}
                                  <button
                                    type="button"
                                    onClick={() => handleViewDocument(invite.id, doc.id)}
                                    style={{
                                      background: "none",
                                      border: "none",
                                      padding: 0,
                                      color: "var(--vetro-teal-dark)",
                                      textDecoration: "underline",
                                      cursor: "pointer",
                                      fontSize: 13,
                                    }}
                                  >
                                    View
                                  </button>
                                </span>
                              ))
                            )}
                          </p>
                          <button
                            className="btn btn-primary"
                            disabled={isConverting}
                            onClick={() => handleConvert(invite.id)}
                          >
                            <CheckIcon width={14} height={14} />
                            Add to roster
                          </button>
                          <div style={{ marginTop: 16 }}>
                            <ComplianceGapPanel
                              loadGaps={() => api.getVettingInviteComplianceGaps(invite.id)}
                              loadAiReview={() => api.getVettingInviteAiReview(invite.id)}
                            />
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
