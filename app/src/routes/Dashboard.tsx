import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { InviteCandidateModal } from "../components/InviteCandidateModal.js";
import { CheckStatusBadge, DashboardColourBadge } from "../components/StatusBadge.js";
import { FileIcon, PlusIcon, ShieldCheckIcon } from "../components/icons.js";
import { TemporaryPasswordReveal } from "../components/TemporaryPasswordReveal.js";
import { Candidate, CheckType, RoleType, useApi } from "../lib/api.js";
import { CHECK_TYPE_SHORT_LABELS, DASHBOARD_CHECK_COLUMNS, OverallCheckState, overallCheckState, worstCheckColour } from "../lib/status.js";
import { useTenantSlug } from "../lib/tenant.js";

type SortKey = "name" | "role" | "overall";

const OVERALL_SORT_RANK: Record<OverallCheckState, number> = { rejected: 0, pending: 1, verified: 2 };

export function Dashboard() {
  const api = useApi();
  const tenant = useTenantSlug();
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [roleTypes, setRoleTypes] = useState<RoleType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [showInvite, setShowInvite] = useState(false);
  const [lastInviteLink, setLastInviteLink] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | OverallCheckState>("all");
  const [sortKey, setSortKey] = useState<SortKey | undefined>(undefined);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setIsLoading(true);
    try {
      const [candidateList, roleTypeList] = await Promise.all([api.listCandidates(), api.listRoleTypes()]);
      setCandidates(candidateList);
      setRoleTypes(roleTypeList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load candidates");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleInvite(input: { firstName: string; lastName: string; email: string; roleTypeId?: string }) {
    const created = await api.inviteCandidate(input);
    setLastInviteLink(`${window.location.origin}/candidates/${created.inviteToken}`);
    await load();
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function sortArrow(key: SortKey): string {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? "↑" : "↓";
  }

  // Opens a real candidate's own magic-link page — the same self-service
  // flow they'd get emailed — so an admin can sanity-check it before
  // sending invites out, without needing a fake preview mode.
  function openSelfServePreview() {
    const target = candidates.find((c) => overallCheckState(c) !== "verified") ?? candidates[0];
    if (target) window.open(`/candidates/${target.inviteToken}`, "_blank");
  }

  const counts = { green: 0, amber: 0, red: 0 };
  for (const candidate of candidates) counts[worstCheckColour(candidate)] += 1;
  const verifiedCount = candidates.filter((c) => overallCheckState(c) === "verified").length;
  const pendingCount = candidates.length - verifiedCount;
  const expiringCount = candidates.filter((c) => worstCheckColour(c) === "amber").length;
  const isAllGreen = candidates.length > 0 && pendingCount === 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = candidates.filter((c) => {
      const matchesSearch = !q || `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) || (c.roleType?.name.toLowerCase().includes(q) ?? false);
      const matchesFilter = filter === "all" || overallCheckState(c) === filter;
      return matchesSearch && matchesFilter;
    });
    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        let cmp: number;
        if (sortKey === "name") cmp = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
        else if (sortKey === "role") cmp = (a.roleType?.name ?? "").localeCompare(b.roleType?.name ?? "");
        else cmp = OVERALL_SORT_RANK[overallCheckState(a)] - OVERALL_SORT_RANK[overallCheckState(b)];
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return rows;
  }, [candidates, search, filter, sortKey, sortDir]);

  function checkCell(candidate: Candidate, checkType: CheckType) {
    const check = candidate.checks.find((c) => c.checkType === checkType);
    if (!check) return <span className="dashboard-check-na">—</span>;
    return <CheckStatusBadge status={check.status} />;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Candidates</h1>
          <p>Review verification status across your organisation</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={openSelfServePreview} disabled={candidates.length === 0}>
            Preview candidate link
          </button>
          <button className="btn btn-primary" onClick={() => setShowInvite(true)}>
            <PlusIcon width={14} height={14} />
            Invite candidate
          </button>
        </div>
      </div>

      {lastInviteLink && (
        <div className="card" style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 14, marginBottom: 4 }}>
            Candidate invited. Their magic link (in case the email doesn't arrive):
          </p>
          <TemporaryPasswordReveal password={lastInviteLink} />
        </div>
      )}

      {error && <p className="error-text">{error}</p>}

      {isAllGreen && (
        <div className="dashboard-all-clear">All candidates are fully verified. Nothing needs your attention right now.</div>
      )}

      {isLoading ? (
        <p style={{ color: "var(--lunara-text-muted)" }}>Loading…</p>
      ) : candidates.length === 0 ? (
        <div className="card empty-state" style={{ margin: "32px 0" }}>
          <span className="empty-icon">
            <ShieldCheckIcon />
          </span>
          <h2 style={{ fontSize: 22, marginBottom: 10 }}>No candidates yet</h2>
          <p>Invite your first candidate to start collecting and verifying their compliance documents.</p>
          <button className="btn btn-primary" onClick={() => setShowInvite(true)} style={{ marginTop: 8 }}>
            Invite your first candidate
          </button>
        </div>
      ) : (
        <>
          <div className="summary-grid">
            <div className="summary-tile">
              <div>
                <div className="label">Total candidates</div>
                <div className="count">{candidates.length}</div>
              </div>
            </div>
            <div className="summary-tile summary-tile-green">
              <div>
                <div className="label">Fully verified</div>
                <div className="count" style={{ color: "var(--lunara-status-green-text)" }}>{verifiedCount}</div>
              </div>
            </div>
            <div className="summary-tile summary-tile-amber">
              <div>
                <div className="label">Pending review</div>
                <div className="count" style={{ color: "var(--lunara-status-amber-text)" }}>{pendingCount}</div>
              </div>
            </div>
            <div className="summary-tile summary-tile-red">
              <div>
                <div className="label">Expiring soon</div>
                <div className="count" style={{ color: "var(--lunara-status-red-text)" }}>{expiringCount}</div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <input
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or role"
              style={{ flex: "0 0 280px" }}
            />
            <select className="input" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
              <option value="all">All statuses</option>
              <option value="verified">Verified</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>
            <div style={{ flex: 1 }} />
            <button className="btn btn-secondary" onClick={() => navigate(`/${tenant}/report`)}>
              <FileIcon width={14} height={14} />
              Generate event report
            </button>
          </div>

          <table className="data-table dashboard-table">
            <thead>
              <tr>
                <th>
                  <button className="dashboard-sort-header" onClick={() => toggleSort("name")}>
                    Name {sortArrow("name")}
                  </button>
                </th>
                <th>
                  <button className="dashboard-sort-header" onClick={() => toggleSort("role")}>
                    Role {sortArrow("role")}
                  </button>
                </th>
                {DASHBOARD_CHECK_COLUMNS.map((ct) => (
                  <th key={ct}>{CHECK_TYPE_SHORT_LABELS[ct]}</th>
                ))}
                <th>
                  <button className="dashboard-sort-header" onClick={() => toggleSort("overall")}>
                    Overall {sortArrow("overall")}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((candidate) => (
                <tr key={candidate.id} className="clickable" onClick={() => navigate(`/${tenant}/candidates/${candidate.id}`)}>
                  <td>
                    <div>{candidate.firstName} {candidate.lastName}</div>
                    <div style={{ fontSize: 12, color: "var(--lunara-text-muted)" }}>{candidate.email}</div>
                  </td>
                  <td>{candidate.roleType?.name ?? "—"}</td>
                  {DASHBOARD_CHECK_COLUMNS.map((ct) => (
                    <td key={ct}>{checkCell(candidate, ct)}</td>
                  ))}
                  <td>
                    <DashboardColourBadge colour={worstCheckColour(candidate)} />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={3 + DASHBOARD_CHECK_COLUMNS.length} style={{ textAlign: "center", color: "var(--lunara-text-muted)", padding: 40 }}>
                    No candidates match this search or filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}

      {showInvite && (
        <InviteCandidateModal roleTypes={roleTypes} onClose={() => setShowInvite(false)} onSubmit={handleInvite} />
      )}

      {roleTypes.length === 0 && !isLoading && candidates.length > 0 && (
        <p className="subtle-meta" style={{ marginTop: 16 }}>
          <FileIcon width={14} height={14} style={{ verticalAlign: "-2px", marginRight: 4 }} />
          No role types configured yet — <Link to={`/${tenant}/role-types`}>set up which checks each role needs</Link>.
        </p>
      )}
    </div>
  );
}
