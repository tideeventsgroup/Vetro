import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { InviteCandidateModal } from "../components/InviteCandidateModal.js";
import { CandidateStatusBadge, DashboardColourBadge } from "../components/StatusBadge.js";
import { FileIcon, PlusIcon, ShieldCheckIcon } from "../components/icons.js";
import { TemporaryPasswordReveal } from "../components/TemporaryPasswordReveal.js";
import { Candidate, RoleType, useApi } from "../lib/api.js";
import { worstCheckColour } from "../lib/status.js";
import { useTenantSlug } from "../lib/tenant.js";

export function Dashboard() {
  const api = useApi();
  const tenant = useTenantSlug();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [roleTypes, setRoleTypes] = useState<RoleType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [showInvite, setShowInvite] = useState(false);
  const [lastInviteLink, setLastInviteLink] = useState<string | undefined>(undefined);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openBulkReport() {
    window.open(`/${tenant}/report?ids=${Array.from(selected).join(",")}`, "_blank");
  }

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

  const counts = { green: 0, amber: 0, red: 0 };
  for (const candidate of candidates) counts[worstCheckColour(candidate)] += 1;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Candidates</h1>
          <p>Everyone invited to submit compliance documents, at a glance.</p>
        </div>
        <div className="page-actions">
          {selected.size > 0 && (
            <button className="btn btn-secondary" onClick={openBulkReport}>
              <FileIcon width={14} height={14} />
              Export {selected.size} selected
            </button>
          )}
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

      <div className="summary-grid">
        <div className="summary-tile">
          <div>
            <div className="count">{counts.green}</div>
            <div className="label">Fully verified</div>
          </div>
          <DashboardColourBadge colour="green" />
        </div>
        <div className="summary-tile">
          <div>
            <div className="count">{counts.amber}</div>
            <div className="label">Needs attention</div>
          </div>
          <DashboardColourBadge colour="amber" />
        </div>
        <div className="summary-tile">
          <div>
            <div className="count">{counts.red}</div>
            <div className="label">Missing or expired</div>
          </div>
          <DashboardColourBadge colour="red" />
        </div>
      </div>

      {isLoading ? (
        <p style={{ color: "var(--lunara-text-muted)" }}>Loading…</p>
      ) : candidates.length === 0 ? (
        <div className="card empty-state">
          <span className="empty-icon">
            <ShieldCheckIcon />
          </span>
          <p>No candidates invited yet.</p>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th></th>
              <th>Name</th>
              <th>Role type</th>
              <th>Compliance</th>
              <th>Progress</th>
              <th>Invited</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((candidate) => (
              <tr key={candidate.id}>
                <td onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(candidate.id)}
                    onChange={() => toggleSelected(candidate.id)}
                  />
                </td>
                <td>
                  <Link to={`/${tenant}/candidates/${candidate.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                    <div className="officer-cell">
                      <span className="officer-avatar">
                        {candidate.firstName[0]}
                        {candidate.lastName[0]}
                      </span>
                      <div>
                        <div>
                          {candidate.firstName} {candidate.lastName}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--lunara-text-muted)" }}>{candidate.email}</div>
                      </div>
                    </div>
                  </Link>
                </td>
                <td>{candidate.roleType?.name ?? "—"}</td>
                <td>
                  <DashboardColourBadge colour={worstCheckColour(candidate)} />
                </td>
                <td>
                  <CandidateStatusBadge status={candidate.status} />
                </td>
                <td>{new Date(candidate.createdAt).toLocaleDateString("en-GB")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showInvite && (
        <InviteCandidateModal roleTypes={roleTypes} onClose={() => setShowInvite(false)} onSubmit={handleInvite} />
      )}

      {roleTypes.length === 0 && !isLoading && (
        <p className="subtle-meta" style={{ marginTop: 16 }}>
          <FileIcon width={14} height={14} style={{ verticalAlign: "-2px", marginRight: 4 }} />
          No role types configured yet — <Link to={`/${tenant}/role-types`}>set up which checks each role needs</Link>.
        </p>
      )}
    </div>
  );
}
