import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AddOfficerModal } from "../components/AddOfficerModal.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { Contractor, DashboardSummary, Officer, useApi } from "../lib/api.js";
import { worstStatus } from "../lib/status.js";

export function Dashboard() {
  const api = useApi();
  const navigate = useNavigate();

  const [contractor, setContractor] = useState<Contractor | undefined>(undefined);
  const [newContractorName, setNewContractorName] = useState("");
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddOfficer, setShowAddOfficer] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    void loadContractor();
  }, []);

  async function loadContractor() {
    setIsLoading(true);
    try {
      const current = await api.getCurrentContractor();
      if (current) {
        setContractor(current);
        await loadRoster();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load Vetro");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadRoster() {
    const [officerRows, summaryRow] = await Promise.all([api.listOfficers(), api.getDashboardSummary()]);
    setOfficers(officerRows);
    setSummary(summaryRow);
  }

  async function handleCreateContractor() {
    if (!newContractorName.trim()) return;
    const created = await api.createContractor(newContractorName.trim());
    setContractor(created);
    await loadRoster();
  }

  async function handleAddOfficer(input: { firstName: string; lastName: string; email?: string }) {
    await api.createOfficer(input);
    await loadRoster();
  }

  async function handleExport() {
    const blob = await api.downloadExport();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "vetro-compliance-export.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading) return <p>Loading…</p>;

  if (!contractor) {
    return (
      <div className="card" style={{ maxWidth: 420 }}>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>No officers added yet</h2>
        <p style={{ color: "var(--vetro-text-muted)" }}>
          Name your organisation to start automatic checks.
        </p>
        <div className="form-field">
          <label htmlFor="contractorName">Organisation name</label>
          <input
            id="contractorName"
            value={newContractorName}
            onChange={(e) => setNewContractorName(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" onClick={handleCreateContractor}>
          Continue
        </button>
      </div>
    );
  }

  const tally = { ACTIVE: 0, EXPIRING: 0, EXPIRED: 0 };
  for (const officer of officers) tally[worstStatus(officer)]++;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{contractor.name}</h1>
          <p>One record per officer — checked automatically, not chased manually.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={handleExport}>
            Export CSV
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddOfficer(true)}>
            Add officer
          </button>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="summary-grid">
        <div className="summary-tile">
          <div className="count">{officers.length}</div>
          <div className="label">Officers</div>
        </div>
        <div className="summary-tile">
          <div className="count" style={{ color: "var(--vetro-status-green)" }}>
            {tally.ACTIVE}
          </div>
          <div className="label">Active</div>
        </div>
        <div className="summary-tile">
          <div className="count" style={{ color: "var(--vetro-status-amber)" }}>
            {tally.EXPIRING}
          </div>
          <div className="label">Expiring soon</div>
        </div>
        <div className="summary-tile">
          <div className="count" style={{ color: "var(--vetro-status-red)" }}>
            {tally.EXPIRED}
          </div>
          <div className="label">Expired</div>
        </div>
      </div>

      {summary && (
        <p style={{ color: "var(--vetro-text-muted)", fontSize: 13, marginTop: -12, marginBottom: 20 }}>
          Licences — {summary.licences.ACTIVE ?? 0} active, {summary.licences.EXPIRING ?? 0} expiring,{" "}
          {summary.licences.EXPIRED ?? 0} expired · Vetting — {summary.vetting.ACTIVE ?? 0} active,{" "}
          {summary.vetting.EXPIRING ?? 0} expiring, {summary.vetting.EXPIRED ?? 0} expired
        </p>
      )}

      {officers.length === 0 ? (
        <p style={{ color: "var(--vetro-text-muted)" }}>
          No officers added yet. Add your first officer to start automatic checks.
        </p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Officer</th>
              <th>Status</th>
              <th>Licences</th>
              <th>Vetting</th>
            </tr>
          </thead>
          <tbody>
            {officers.map((officer) => (
              <tr key={officer.id} className="clickable" onClick={() => navigate(`/officers/${officer.id}`)}>
                <td>
                  {officer.firstName} {officer.lastName}
                </td>
                <td>
                  <StatusBadge status={worstStatus(officer)} />
                </td>
                <td>{officer.licences.length}</td>
                <td>{officer.vettingRecords.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showAddOfficer && (
        <AddOfficerModal onClose={() => setShowAddOfficer(false)} onSubmit={handleAddOfficer} />
      )}
    </div>
  );
}
