import { FormEvent, useEffect, useState } from "react";
import { MailIcon, TrashIcon, UsersIcon } from "../components/icons.js";
import { TemporaryPasswordReveal } from "../components/TemporaryPasswordReveal.js";
import { TeamMember, useApi } from "../lib/api.js";

export function Team() {
  const api = useApi();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [invitedPassword, setInvitedPassword] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [isLoadingTeam, setIsLoadingTeam] = useState(true);
  const [removingUsername, setRemovingUsername] = useState<string | undefined>(undefined);

  useEffect(() => {
    void loadTeam();
  }, []);

  async function loadTeam() {
    setIsLoadingTeam(true);
    try {
      setTeam(await api.listTeam());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load team");
    } finally {
      setIsLoadingTeam(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    setStatus(undefined);
    setInvitedPassword(undefined);
    setIsSubmitting(true);
    try {
      const result = await api.inviteTeammate(email.trim());
      setStatus(`Account created for ${result.email}. Cognito's own email may take a moment (or not arrive — it's capped at 50/day pool-wide) — share this temporary password directly if needed:`);
      setInvitedPassword(result.temporaryPassword);
      setEmail("");
      await loadTeam();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send invitation");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRemove(member: TeamMember) {
    if (!window.confirm(`Remove ${member.email} from this organisation?`)) return;
    setRemovingUsername(member.username);
    try {
      await api.removeTeammate(member.username);
      await loadTeam();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove teammate");
    } finally {
      setRemovingUsername(undefined);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Team</h1>
          <p>Invite colleagues to manage your organisation's roster alongside you.</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 460 }}>
        <span className="empty-icon" style={{ background: "var(--vetro-teal-light)", color: "var(--vetro-teal-dark)" }}>
          <UsersIcon />
        </span>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Invite a teammate</h2>
        <p style={{ color: "var(--vetro-text-muted)", fontSize: 14, marginBottom: 16 }}>
          They'll get an email with a temporary password and full admin access to this organisation.
        </p>
        <form onSubmit={handleSubmit}>
          {error && <p className="error-text">{error}</p>}
          <div className="form-field">
            <label htmlFor="teammateEmail">Email</label>
            <input
              id="teammateEmail"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
            <MailIcon width={14} height={14} />
            {isSubmitting ? "Sending…" : "Send invite"}
          </button>
        </form>
        {status && <p className="subtle-meta">{status}</p>}
        {invitedPassword && <TemporaryPasswordReveal password={invitedPassword} />}
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Current team</h2>
        </div>
        {isLoadingTeam ? (
          <p style={{ color: "var(--vetro-text-muted)" }}>Loading…</p>
        ) : team.length === 0 ? (
          <p style={{ color: "var(--vetro-text-muted)", fontSize: 14 }}>No teammates yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {team.map((member) => (
                <tr key={member.username}>
                  <td>{member.email}</td>
                  <td>{member.status}</td>
                  <td>
                    <button
                      className="btn btn-secondary"
                      disabled={removingUsername === member.username}
                      onClick={() => handleRemove(member)}
                    >
                      <TrashIcon width={14} height={14} />
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
