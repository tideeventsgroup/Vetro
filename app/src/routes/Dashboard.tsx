import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AddOfficerModal } from "../components/AddOfficerModal.js";
import { PinBadge, VettingBadge } from "../components/OfficerBadges.js";
import { DownloadIcon, PlusIcon, RosterIcon, ShieldCheckIcon, WarningIcon } from "../components/icons.js";
import { Contractor, DashboardSummary, Officer, OfficerHrInput, Shift, Site, useApi } from "../lib/api.js";
import { useAuth } from "../lib/auth.js";
import { useTenantSlug } from "../lib/tenant.js";
import { worstStatus } from "../lib/status.js";

const SKIP_AUTH = import.meta.env.VITE_SKIP_AUTH === "true";

function initials(officer: Officer): string {
  return `${officer.firstName[0] ?? ""}${officer.lastName[0] ?? ""}`.toUpperCase();
}

function formatShiftWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOfDay(d) - startOfDay(now)) / 86_400_000);
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (days === 0) return `Today ${time}`;
  if (days === 1) return `Tomorrow ${time}`;
  return `${d.toLocaleDateString([], { weekday: "short" })} ${time}`;
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
  const [sites, setSites] = useState<Site[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
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
    const now = new Date();
    const from = now.toISOString();
    const to = new Date(now.getTime() + 30 * 86_400_000).toISOString();
    const [officerRows, summaryRow, pendingSubmissions, siteRows, shiftRows] = await Promise.all([
      api.listOfficers(),
      api.getDashboardSummary(),
      api.listVettingSubmissionsForReview("PENDING_REVIEW"),
      api.listSites(),
      api.listShifts({ from, to }),
    ]);
    setOfficers(officerRows);
    setSummary(summaryRow);
    setPendingReviewCount(pendingSubmissions.length);
    setSites(siteRows);
    setShifts(shiftRows);
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

  const blockedOfficers = officers.filter((o) => worstStatus(o) === "EXPIRED");
  const expiringOfficers = officers.filter((o) => worstStatus(o) === "EXPIRING");
  const activeCount = officers.length - blockedOfficers.length;

  const siteById = new Map(sites.map((s) => [s.id, s]));
  const nextShiftByOfficer = new Map<string, Shift>();
  for (const shift of [...shifts].sort((a, b) => +new Date(a.startTime) - +new Date(b.startTime))) {
    if (shift.officerId && !nextShiftByOfficer.has(shift.officerId)) nextShiftByOfficer.set(shift.officerId, shift);
  }
  const sitesAtRisk = new Set(
    officers
      .filter((o) => worstStatus(o) !== "ACTIVE")
      .map((o) => nextShiftByOfficer.get(o.id)?.siteId)
      .filter((id): id is string => Boolean(id)),
  );

  const kpis = [
    { label: "Active operatives", value: activeCount, color: "var(--vetro-text)" },
    { label: "Expiring within 30 days", value: expiringOfficers.length, color: "var(--vetro-status-amber-text)" },
    { label: "Expired / PIN blocked", value: blockedOfficers.length, color: "var(--vetro-status-red-text)" },
    { label: "Sites currently at risk", value: sitesAtRisk.size, color: "var(--vetro-status-amber-text)" },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{friendlyName(email) ? `Welcome back, ${friendlyName(email)}` : contractor.name}</h1>
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

      {error && <p className="error-text">{error}</p>}

      {blockedOfficers.length > 0 && (
        <div
          className="card"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
            marginBottom: 20,
            background: "var(--vetro-badge-red-bg)",
            borderColor: "var(--vetro-status-red-text)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 240 }}>
            <span style={{ color: "var(--vetro-status-red-text)", flexShrink: 0 }}>
              <WarningIcon />
            </span>
            <div>
              <strong style={{ color: "var(--vetro-status-red-text)" }}>
                {blockedOfficers.length} PIN{blockedOfficers.length === 1 ? "" : "s"} blocked by an expired licence or vetting record
              </strong>
              <p style={{ color: "var(--vetro-status-red-text)", fontSize: 13, margin: 0 }}>
                Shifts left unassigned as a result. Licence and vetting status gate kiosk PIN access automatically —
                no manual step required.
              </p>
            </div>
          </div>
          <a
            href="#operative-status"
            className="btn"
            style={{ background: "var(--vetro-status-red-text)", color: "var(--vetro-white)", whiteSpace: "nowrap", textDecoration: "none" }}
          >
            Review blocked operatives
          </a>
        </div>
      )}

      {pendingReviewCount > 0 && (
        <Link
          to={`/${tenant}/vetting-queue`}
          className="card"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 20,
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

      <div className="summary-grid">
        {kpis.map((kpi) => (
          <div className="summary-tile" key={kpi.label}>
            <div>
              <div className="count" style={{ color: kpi.color }}>
                {kpi.value}
              </div>
              <div className="label">{kpi.label}</div>
            </div>
          </div>
        ))}
      </div>

      {officers.length === 0 ? (
        <div className="card empty-state">
          <span className="empty-icon">
            <RosterIcon />
          </span>
          <p>No officers added yet. Add your first officer to start automatic checks.</p>
        </div>
      ) : (
        <table className="data-table" id="operative-status">
          <thead>
            <tr>
              <th>Operative</th>
              <th>Site</th>
              <th>Vetting status</th>
              <th>PIN</th>
              <th>Next shift</th>
            </tr>
          </thead>
          <tbody>
            {officers.map((officer) => {
              const nextShift = nextShiftByOfficer.get(officer.id);
              const site = nextShift ? siteById.get(nextShift.siteId) : undefined;
              return (
                <tr key={officer.id} className="clickable" onClick={() => navigate(`/${tenant}/officers/${officer.id}`)}>
                  <td>
                    <div className="officer-cell">
                      <span className="officer-avatar">{initials(officer)}</span>
                      {officer.firstName} {officer.lastName}
                    </div>
                  </td>
                  <td>{site?.name ?? "—"}</td>
                  <td>
                    <VettingBadge officer={officer} />
                  </td>
                  <td>
                    <PinBadge officer={officer} />
                  </td>
                  <td>
                    {worstStatus(officer) === "EXPIRED" ? (
                      <span style={{ color: "var(--vetro-status-red-text)" }}>Unassigned</span>
                    ) : nextShift ? (
                      formatShiftWhen(nextShift.startTime)
                    ) : (
                      <span style={{ color: "var(--vetro-text-muted)" }}>Unassigned</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {summary && (
        <p className="subtle-meta" style={{ marginTop: 16, marginBottom: 0 }}>
          Licences — {summary.licences.ACTIVE ?? 0} active, {summary.licences.EXPIRING ?? 0} expiring,{" "}
          {summary.licences.EXPIRED ?? 0} expired · Vetting — {summary.vetting.ACTIVE ?? 0} active,{" "}
          {summary.vetting.EXPIRING ?? 0} expiring, {summary.vetting.EXPIRED ?? 0} expired
        </p>
      )}

      {showAddOfficer && (
        <AddOfficerModal onClose={() => setShowAddOfficer(false)} onSubmit={handleAddOfficer} />
      )}
    </div>
  );
}
