import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { StatusBadge } from "../components/StatusBadge.js";
import { Officer, useApi } from "../lib/api.js";

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
}

export function OfficerDetail() {
  const { id } = useParams<{ id: string }>();
  const api = useApi();
  const [officer, setOfficer] = useState<Officer | undefined>(undefined);
  const [showAddLicence, setShowAddLicence] = useState(false);
  const [showAddVetting, setShowAddVetting] = useState(false);

  useEffect(() => {
    if (id) void load(id);
  }, [id]);

  async function load(officerId: string) {
    setOfficer(await api.getOfficer(officerId));
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

  if (!officer) return <p>Loading…</p>;

  return (
    <div>
      <Link to="/" style={{ fontSize: 13, color: "var(--vetro-text-muted)" }}>
        ← Back to roster
      </Link>
      <div className="page-header" style={{ marginTop: 12 }}>
        <h1>
          {officer.firstName} {officer.lastName}
        </h1>
      </div>

      <div className="card">
        <div className="page-header" style={{ marginBottom: 12 }}>
          <h2 style={{ fontSize: 16 }}>SIA licences</h2>
          <button className="btn btn-secondary" onClick={() => setShowAddLicence((v) => !v)}>
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
          <p style={{ color: "var(--vetro-text-muted)" }}>No licences on file.</p>
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
        <div className="page-header" style={{ marginBottom: 12 }}>
          <h2 style={{ fontSize: 16 }}>BS7858 vetting</h2>
          <button className="btn btn-secondary" onClick={() => setShowAddVetting((v) => !v)}>
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
          <p style={{ color: "var(--vetro-text-muted)" }}>No vetting on file.</p>
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
    </div>
  );
}
