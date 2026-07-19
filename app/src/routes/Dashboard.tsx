import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AddOfficerModal } from "../components/AddOfficerModal.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { DownloadIcon, PlusIcon, RosterIcon, ShieldCheckIcon } from "../components/icons.js";
import { Contractor, DashboardSummary, Officer, OfficerHrInput, useApi } from "../lib/api.js";
import { useAuth } from "../lib/auth.js";
import { useTenantSlug } from "../lib/tenant.js";
import { worstStatus } from "../lib/status.js";

const SKIP_AUTH = import.meta.env.VITE_SKIP_AUTH === "true";

function initials(officer: Officer): string {
  return `${officer.firstName[0] ?? ""}${officer.lastName[0] ?? ""}`.toUpperCase();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// There's no separate "display name" anywhere for an ADMIN/teammate account
// (only officers have firstName/lastName) — the email's local part is the
// closest thing to one, so "kyle.robb@..." greets as "Welcome back, Kyle".
function friendlyName(email: string | undefined): string | undefined {
  if (!email) return undefined;
  const local = email.split("@")[0];
  const first = local?.split(/[._-]/)[0];
  return first ? first[0]!.toUpperCase() + first.slice(1) : undefined;
}

export function Dashboard() {
  const api = useApi();
  const navigate = useNavigate();
  const tenant = useTenantSlug();
  const { refreshClaims, email } = useAuth();

  const [contractor, setContractor] = useState<Contractor | undefined>(undefined);
  const [newContractorName, setNewContractorName] = useState("");
  const [newContractorSlug, setNewContractorSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | undefined>(undefined);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);
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
    const [officerRows, summaryRow, pendingSubmissions] = await Promise.all([
      api.listOfficers(),
      api.getDashboardSummary(),
      api.listVettingSubmissionsForReview("PENDING_REVIEW"),
    ]);
    setOfficers(officerRows);
    setSummary(summaryRow);
    setPendingReviewCount(pendingSubmissions.length);
  }

  function handleNameChange(value: string) {
    setNewContractorName(value);
    if (!slugEdited) setNewContractorSlug(slugify(value));
  }

  // Reachable by any signed-in account with no organization yet — most
  // often one that started self-serve signup (see routes/Signup.tsx) but
  // never finished the org-creation step (closed the tab, hit an error).
  // SKIP_AUTH dev mode keeps the old dev-only /contractors route (slug
  // comes from the subdomain/path there, not this form) since there's no
  // real Cognito account to grant custom:contractor_id/role to locally.
  async function handleCreateContractor() {
    if (!newContractorName.trim()) return;
    setError(undefined);
    try {
      if (SKIP_AUTH) {
        const created = await api.createContractor(newContractorName.trim());
        setContractor(created);
        await loadRoster();
        return;
      }

      const created = await api.createOrganizationSelfSignup({
        name: newContractorName.trim(),
        slug: newContractorSlug || slugify(newContractorName),
      });
      // The current token predates this grant — refresh so custom:contractor_id/role are on it.
      await refreshClaims();
      navigate(`/${created.slug}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create organisation");
    }
  }

  async function handleAddOfficer(input: { firstName: string; lastName: string } & OfficerHrInput) {
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

  if (isLoading) return <p style={{ color: "var(--vetro-text-muted)" }}>Loading…</p>;

  if (!contractor) {
    return (
      <div className="card" style={{ maxWidth: 420 }}>
        <span className="empty-icon">
          <ShieldCheckIcon />
        </span>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Set up your organisation</h2>
        <p style={{ color: "var(--vetro-text-muted)" }}>
          You're signed in, but not attached to an organisation yet — finish setting one up to
          start automatic checks.
        </p>
        {error && <p className="error-text">{error}</p>}
        <div className="form-field">
          <label htmlFor="contractorName">Organisation name</label>
          <input id="contractorName" value={newContractorName} onChange={(e) => handleNameChange(e.target.value)} />
        </div>
        {!SKIP_AUTH && (
          <div className="form-field">
            <label htmlFor="contractorSlug">Your Vetro URL</label>
            <input
              id="contractorSlug"
              value={newContractorSlug}
              onChange={(e) => {
                setSlugEdited(true);
                setNewContractorSlug(slugify(e.target.value));
              }}
            />
            <p className="subtle-meta">
              {window.location.origin}/{newContractorSlug || "your-org"}
            </p>
          </div>
        )}
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
          <h1>{friendlyName(email) ? `Welcome back, ${friendlyName(email)}` : contractor.name}</h1>
          <p>
            {contractor.name} — checked automatically, not chased manually.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={handleExport}>
            <DownloadIcon />
            Export CSV
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddOfficer(true)}>
            <PlusIcon />
            Add officer
          </button>
        </div>
      </div>

      <div className="summary-grid">
        <div className="summary-tile">
          <div>
            <div className="count">{officers.length}</div>
            <div className="label">Officers</div>
          </div>
          <span className="tile-icon">
            <RosterIcon />
          </span>
        </div>
        <div className="summary-tile">
          <div>
            <div className="count" style={{ color: "#1C7A45" }}>
              {tally.ACTIVE}
            </div>
            <div className="label">Active</div>
          </div>
        </div>
        <div className="summary-tile">
          <div>
            <div className="count" style={{ color: "#C24A16" }}>
              {tally.EXPIRING}
            </div>
            <div className="label">Expiring soon</div>
          </div>
        </div>
        <div className="summary-tile">
          <div>
            <div className="count" style={{ color: "var(--vetro-status-red)" }}>
              {tally.EXPIRED}
            </div>
            <div className="label">Expired</div>
          </div>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {pendingReviewCount > 0 && (
        <Link
          to={`/${tenant}/vetting-queue`}
          className="card"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 24,
            borderLeft: "3px solid var(--vetro-status-amber)",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <span className="empty-icon" style={{ background: "var(--vetro-teal-light)", color: "var(--vetro-teal-dark)", flexShrink: 0 }}>
            <ShieldCheckIcon />
          </span>
          <div>
            <strong>
              {pendingReviewCount} vetting submission{pendingReviewCount === 1 ? "" : "s"} awaiting review
            </strong>
            <p style={{ color: "var(--vetro-text-muted)", fontSize: 13, margin: 0 }}>
              Officers have submitted details through self-service — go through the queue.
            </p>
          </div>
        </Link>
      )}

      {summary && (
        <p className="subtle-meta">
          Licences — {summary.licences.ACTIVE ?? 0} active, {summary.licences.EXPIRING ?? 0} expiring,{" "}
          {summary.licences.EXPIRED ?? 0} expired · Vetting — {summary.vetting.ACTIVE ?? 0} active,{" "}
          {summary.vetting.EXPIRING ?? 0} expiring, {summary.vetting.EXPIRED ?? 0} expired
        </p>
      )}

      {officers.length === 0 ? (
        <div className="card empty-state">
          <span className="empty-icon">
            <RosterIcon />
          </span>
          <p>No officers added yet. Add your first officer to start automatic checks.</p>
        </div>
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
              <tr key={officer.id} className="clickable" onClick={() => navigate(`/${tenant}/officers/${officer.id}`)}>
                <td>
                  <div className="officer-cell">
                    <span className="officer-avatar">{initials(officer)}</span>
                    {officer.firstName} {officer.lastName}
                  </div>
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
