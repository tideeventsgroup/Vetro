import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DocumentsSection } from "../components/DocumentsSection.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { TemporaryPasswordReveal } from "../components/TemporaryPasswordReveal.js";
import { ArrowLeftIcon, MailIcon, PlusIcon } from "../components/icons.js";
import { Officer, useApi } from "../lib/api.js";
import { useTenantSlug } from "../lib/tenant.js";

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
}

function initials(officer: Officer): string {
  return `${officer.firstName[0] ?? ""}${officer.lastName[0] ?? ""}`.toUpperCase();
}

export function OfficerDetail() {
  const { id } = useParams<{ id: string }>();
  const api = useApi();
  const tenant = useTenantSlug();
  const [officer, setOfficer] = useState<Officer | undefined>(undefined);
  const [showAddLicence, setShowAddLicence] = useState(false);
  const [showAddVetting, setShowAddVetting] = useState(false);
  const [showAddQualification, setShowAddQualification] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteStatus, setInviteStatus] = useState<string | undefined>(undefined);
  const [invitedPassword, setInvitedPassword] = useState<string | undefined>(undefined);
  const [inviteError, setInviteError] = useState<string | undefined>(undefined);
  const [isInviting, setIsInviting] = useState(false);

  useEffect(() => {
    if (id) void load(id);
  }, [id]);

  async function load(officerId: string) {
    const loaded = await api.getOfficer(officerId);
    setOfficer(loaded);
    setInviteEmail((current) => current || loaded.email || "");
  }

  async function handleAddLicence(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!id) return;
    const form = new FormData(e.currentTarget);
    await api.createLicence(id, {
      licenceNumber: String(form.get("licenceNumber")),
      sector: String(form.get("sector")),
      issueDate: String(form.get("issueDate")),
      expiryDate: String(form.get("expiryDate")),
    });
    setShowAddLicence(false);
    await load(id);
  }

  async function handleAddVetting(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!id) return;
    const form = new FormData(e.currentTarget);
    await api.createVettingRecord(id, {
      standard: String(form.get("standard") || "BS7858"),
      completedDate: String(form.get("completedDate")),
      expiryDate: String(form.get("expiryDate") || "") || undefined,
    });
    setShowAddVetting(false);
    await load(id);
  }

  async function handleAddQualification(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!id) return;
    const form = new FormData(e.currentTarget);
    await api.createQualification(id, {
      name: String(form.get("name")),
      issuedBy: String(form.get("issuedBy") || "") || undefined,
      issueDate: String(form.get("qualIssueDate") || "") || undefined,
      expiryDate: String(form.get("qualExpiryDate") || "") || undefined,
    });
    setShowAddQualification(false);
    await load(id);
  }

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setInviteStatus(undefined);
    setInvitedPassword(undefined);
    setInviteError(undefined);
    setIsInviting(true);
    try {
      const result = await api.inviteOfficer(id, inviteEmail.trim() || undefined);
      setInviteStatus(
        `Account created for ${result.email}. Email may not arrive (Cognito's sender is capped at 50/day) — share this temporary password directly if needed:`
      );
      setInvitedPassword(result.temporaryPassword);
      await load(id);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Could not send invitation");
    } finally {
      setIsInviting(false);
    }
  }

  if (!officer) return <p style={{ color: "var(--vetro-text-muted)" }}>Loading…</p>;

  return (
    <div>
      <div className="page-header" style={{ alignItems: "center" }}>
        <h1 style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="officer-avatar" style={{ width: 40, height: 40, fontSize: 15 }}>
            {initials(officer)}
          </span>
          {officer.firstName} {officer.lastName}
        </h1>
      </div>
      <Link
        to={`/${tenant}`}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--vetro-text-muted)", marginBottom: 12 }}
      >
        <ArrowLeftIcon width={14} height={14} />
        Back to roster
      </Link>

      <div className="card">
        <div className="card-header">
          <h2>Self-service portal</h2>
        </div>
        <p style={{ color: "var(--vetro-text-muted)", fontSize: 14, marginBottom: 12 }}>
          Give this officer their own login to submit vetting details and documents for review.
        </p>
        {inviteError && <p className="error-text">{inviteError}</p>}
        <form onSubmit={handleInvite} style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="form-field" style={{ marginBottom: 0, minWidth: 240 }}>
            <label htmlFor="inviteEmail">Email</label>
            <input
              id="inviteEmail"
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
          </div>
          <button className="btn btn-secondary" type="submit" disabled={isInviting}>
            <MailIcon width={14} height={14} />
            {isInviting ? "Sending…" : "Send invite"}
          </button>
        </form>
        {inviteStatus && <p className="subtle-meta" style={{ marginTop: 12 }}>{inviteStatus}</p>}
        {invitedPassword && <TemporaryPasswordReveal password={invitedPassword} />}
      </div>

      <div className="card">
        <div className="card-header">
          <h2>SIA licences</h2>
          <button className="btn btn-secondary" onClick={() => setShowAddLicence((v) => !v)}>
            {!showAddLicence && <PlusIcon width={14} height={14} />}
            {showAddLicence ? "Cancel" : "Add licence"}
          </button>
        </div>

        {showAddLicence && (
          <form onSubmit={handleAddLicence} style={{ marginBottom: 16 }}>
            <div className="form-field">
              <label htmlFor="licenceNumber">Licence number</label>
              <input id="licenceNumber" name="licenceNumber" required />
            </div>
            <div className="form-field">
              <label htmlFor="sector">Sector</label>
              <input id="sector" name="sector" placeholder="Door Supervisor" required />
            </div>
            <div className="form-field">
              <label htmlFor="issueDate">Issue date</label>
              <input id="issueDate" name="issueDate" type="date" required />
            </div>
            <div className="form-field">
              <label htmlFor="expiryDate">Expiry date</label>
              <input id="expiryDate" name="expiryDate" type="date" required />
            </div>
            <button className="btn btn-primary" type="submit">
              Save licence
            </button>
          </form>
        )}

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
          <h2>BS7858 vetting</h2>
          <button className="btn btn-secondary" onClick={() => setShowAddVetting((v) => !v)}>
            {!showAddVetting && <PlusIcon width={14} height={14} />}
            {showAddVetting ? "Cancel" : "Add record"}
          </button>
        </div>

        {showAddVetting && (
          <form onSubmit={handleAddVetting} style={{ marginBottom: 16 }}>
            <div className="form-field">
              <label htmlFor="standard">Standard</label>
              <input id="standard" name="standard" defaultValue="BS7858" required />
            </div>
            <div className="form-field">
              <label htmlFor="completedDate">Completed date</label>
              <input id="completedDate" name="completedDate" type="date" required />
            </div>
            <div className="form-field">
              <label htmlFor="vettingExpiryDate">Expiry date (optional)</label>
              <input id="vettingExpiryDate" name="expiryDate" type="date" />
            </div>
            <button className="btn btn-primary" type="submit">
              Save record
            </button>
          </form>
        )}

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
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Qualifications</h2>
          <button className="btn btn-secondary" onClick={() => setShowAddQualification((v) => !v)}>
            {!showAddQualification && <PlusIcon width={14} height={14} />}
            {showAddQualification ? "Cancel" : "Add qualification"}
          </button>
        </div>

        {showAddQualification && (
          <form onSubmit={handleAddQualification} style={{ marginBottom: 16 }}>
            <div className="form-field">
              <label htmlFor="name">Name</label>
              <input id="name" name="name" placeholder="First Aid at Work" required />
            </div>
            <div className="form-field">
              <label htmlFor="issuedBy">Issued by (optional)</label>
              <input id="issuedBy" name="issuedBy" />
            </div>
            <div className="form-field">
              <label htmlFor="qualIssueDate">Issue date (optional)</label>
              <input id="qualIssueDate" name="qualIssueDate" type="date" />
            </div>
            <div className="form-field">
              <label htmlFor="qualExpiryDate">Expiry date (optional)</label>
              <input id="qualExpiryDate" name="qualExpiryDate" type="date" />
            </div>
            <button className="btn btn-primary" type="submit">
              Save qualification
            </button>
          </form>
        )}

        {(officer.qualifications ?? []).length === 0 ? (
          <p style={{ color: "var(--vetro-text-muted)", fontSize: 14 }}>No qualifications on file.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Issued by</th>
                <th>Expires</th>
              </tr>
            </thead>
            <tbody>
              {(officer.qualifications ?? []).map((q) => (
                <tr key={q.id}>
                  <td>{q.name}</td>
                  <td>{q.issuedBy ?? "—"}</td>
                  <td>{formatDate(q.expiryDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {id && (
        <DocumentsSection
          documents={officer.documents ?? []}
          onUpload={(file, kind) => api.uploadDocument(id, file, kind)}
          onGetDownloadUrl={(docId) => api.getDocumentDownloadUrl(docId)}
          onChange={() => load(id)}
        />
      )}
    </div>
  );
}
