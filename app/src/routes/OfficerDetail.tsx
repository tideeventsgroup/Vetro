import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DocumentsSection } from "../components/DocumentsSection.js";
import { EmploymentStatusBadge, StatusBadge } from "../components/StatusBadge.js";
import { TemporaryPasswordReveal } from "../components/TemporaryPasswordReveal.js";
import { ArrowLeftIcon, MailIcon, PlusIcon } from "../components/icons.js";
import { EmploymentStatus, EmploymentType, Officer, PayRateType, useApi } from "../lib/api.js";
import { useTenantSlug } from "../lib/tenant.js";

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
}

// <input type="date"> wants yyyy-mm-dd; the API gives back a full ISO
// timestamp, so this strips it down for use as a form defaultValue.
function toDateInputValue(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}

function initials(officer: Officer): string {
  return `${officer.firstName[0] ?? ""}${officer.lastName[0] ?? ""}`.toUpperCase();
}

const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CASUAL: "Casual",
  ZERO_HOURS: "Zero-hours",
};

const EMPLOYMENT_STATUS_LABELS: Record<EmploymentStatus, string> = {
  ACTIVE: "Active",
  ON_LEAVE: "On leave",
  SUSPENDED: "Suspended",
  LEFT: "Left",
};

const PAY_RATE_TYPE_LABELS: Record<PayRateType, string> = {
  HOURLY: "Per hour",
  DAILY: "Per day",
  SALARY: "Per year (salary)",
};

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
  const [hrStatus, setHrStatus] = useState<string | undefined>(undefined);
  const [isSavingHr, setIsSavingHr] = useState(false);

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

  async function handleSaveHrProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!id) return;
    const form = new FormData(e.currentTarget);
    const str = (name: string) => (String(form.get(name) || "").trim() || undefined) as string | undefined;
    setIsSavingHr(true);
    setHrStatus(undefined);
    try {
      await api.updateOfficer(id, {
        email: str("email"),
        phone: str("phone"),
        dateOfBirth: str("dateOfBirth"),
        nationalInsuranceNumber: str("nationalInsuranceNumber"),
        addressLine1: str("addressLine1"),
        addressLine2: str("addressLine2"),
        city: str("city"),
        postcode: str("postcode"),
        emergencyContactName: str("emergencyContactName"),
        emergencyContactPhone: str("emergencyContactPhone"),
        emergencyContactRelationship: str("emergencyContactRelationship"),
        employeeNumber: str("employeeNumber"),
        jobTitle: str("jobTitle"),
        employmentType: str("employmentType") as EmploymentType | undefined,
        employmentStatus: str("employmentStatus") as EmploymentStatus | undefined,
        startDate: str("startDate"),
        leaveDate: str("leaveDate"),
        payRate: form.get("payRate") ? Number(form.get("payRate")) : undefined,
        payRateType: str("payRateType") as PayRateType | undefined,
        rightToWorkConfirmed: form.get("rightToWorkConfirmed") === "on",
      });
      setHrStatus("Saved");
      await load(id);
    } catch (err) {
      setHrStatus(err instanceof Error ? err.message : "Could not save HR profile");
    } finally {
      setIsSavingHr(false);
    }
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
          <h2>HR profile</h2>
          <EmploymentStatusBadge status={officer.employmentStatus} />
        </div>
        <form onSubmit={handleSaveHrProfile}>
          <h3 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--vetro-text-muted)", margin: "0 0 8px" }}>
            Personal details
          </h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div className="form-field" style={{ flex: 1, minWidth: 200 }}>
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" defaultValue={officer.email ?? ""} />
            </div>
            <div className="form-field" style={{ flex: 1, minWidth: 200 }}>
              <label htmlFor="phone">Phone</label>
              <input id="phone" name="phone" type="tel" defaultValue={officer.phone ?? ""} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div className="form-field" style={{ flex: 1, minWidth: 200 }}>
              <label htmlFor="dateOfBirth">Date of birth</label>
              <input id="dateOfBirth" name="dateOfBirth" type="date" defaultValue={toDateInputValue(officer.dateOfBirth)} />
            </div>
            <div className="form-field" style={{ flex: 1, minWidth: 200 }}>
              <label htmlFor="nationalInsuranceNumber">National Insurance number</label>
              <input id="nationalInsuranceNumber" name="nationalInsuranceNumber" defaultValue={officer.nationalInsuranceNumber ?? ""} />
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="addressLine1">Address line 1</label>
            <input id="addressLine1" name="addressLine1" defaultValue={officer.addressLine1 ?? ""} />
          </div>
          <div className="form-field">
            <label htmlFor="addressLine2">Address line 2</label>
            <input id="addressLine2" name="addressLine2" defaultValue={officer.addressLine2 ?? ""} />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div className="form-field" style={{ flex: 2, minWidth: 200 }}>
              <label htmlFor="city">City</label>
              <input id="city" name="city" defaultValue={officer.city ?? ""} />
            </div>
            <div className="form-field" style={{ flex: 1, minWidth: 140 }}>
              <label htmlFor="postcode">Postcode</label>
              <input id="postcode" name="postcode" defaultValue={officer.postcode ?? ""} />
            </div>
          </div>

          <h3 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--vetro-text-muted)", margin: "16px 0 8px" }}>
            Emergency contact
          </h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div className="form-field" style={{ flex: 1, minWidth: 160 }}>
              <label htmlFor="emergencyContactName">Name</label>
              <input id="emergencyContactName" name="emergencyContactName" defaultValue={officer.emergencyContactName ?? ""} />
            </div>
            <div className="form-field" style={{ flex: 1, minWidth: 160 }}>
              <label htmlFor="emergencyContactPhone">Phone</label>
              <input id="emergencyContactPhone" name="emergencyContactPhone" type="tel" defaultValue={officer.emergencyContactPhone ?? ""} />
            </div>
            <div className="form-field" style={{ flex: 1, minWidth: 160 }}>
              <label htmlFor="emergencyContactRelationship">Relationship</label>
              <input
                id="emergencyContactRelationship"
                name="emergencyContactRelationship"
                defaultValue={officer.emergencyContactRelationship ?? ""}
              />
            </div>
          </div>

          <h3 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--vetro-text-muted)", margin: "16px 0 8px" }}>
            Employment
          </h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div className="form-field" style={{ flex: 1, minWidth: 160 }}>
              <label htmlFor="employeeNumber">Employee number</label>
              <input id="employeeNumber" name="employeeNumber" defaultValue={officer.employeeNumber ?? ""} />
            </div>
            <div className="form-field" style={{ flex: 1, minWidth: 160 }}>
              <label htmlFor="jobTitle">Job title</label>
              <input id="jobTitle" name="jobTitle" placeholder="e.g. Door Supervisor" defaultValue={officer.jobTitle ?? ""} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div className="form-field" style={{ flex: 1, minWidth: 160 }}>
              <label htmlFor="employmentType">Employment type</label>
              <select id="employmentType" name="employmentType" defaultValue={officer.employmentType ?? ""}>
                <option value="">—</option>
                {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field" style={{ flex: 1, minWidth: 160 }}>
              <label htmlFor="employmentStatus">Employment status</label>
              <select id="employmentStatus" name="employmentStatus" defaultValue={officer.employmentStatus}>
                {Object.entries(EMPLOYMENT_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div className="form-field" style={{ flex: 1, minWidth: 160 }}>
              <label htmlFor="startDate">Start date</label>
              <input id="startDate" name="startDate" type="date" defaultValue={toDateInputValue(officer.startDate)} />
            </div>
            <div className="form-field" style={{ flex: 1, minWidth: 160 }}>
              <label htmlFor="leaveDate">Leave date</label>
              <input id="leaveDate" name="leaveDate" type="date" defaultValue={toDateInputValue(officer.leaveDate)} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div className="form-field" style={{ flex: 1, minWidth: 160 }}>
              <label htmlFor="payRate">Pay rate (£)</label>
              <input id="payRate" name="payRate" type="number" min="0" step="0.01" defaultValue={officer.payRate ?? ""} />
            </div>
            <div className="form-field" style={{ flex: 1, minWidth: 160 }}>
              <label htmlFor="payRateType">Pay basis</label>
              <select id="payRateType" name="payRateType" defaultValue={officer.payRateType ?? ""}>
                <option value="">—</option>
                {Object.entries(PAY_RATE_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, margin: "8px 0 16px" }}>
            <input
              type="checkbox"
              name="rightToWorkConfirmed"
              defaultChecked={officer.rightToWorkConfirmed}
              style={{ width: "auto" }}
            />
            Right to work confirmed
          </label>

          {hrStatus && <p className={hrStatus === "Saved" ? "subtle-meta" : "error-text"}>{hrStatus}</p>}
          <button className="btn btn-primary" type="submit" disabled={isSavingHr}>
            {isSavingHr ? "Saving…" : "Save HR profile"}
          </button>
        </form>
      </div>

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
