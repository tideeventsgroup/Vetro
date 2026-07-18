import { FormEvent, useState } from "react";
import { MailIcon, UsersIcon } from "../components/icons.js";
import { useApi } from "../lib/api.js";

export function Team() {
  const api = useApi();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    setStatus(undefined);
    setIsSubmitting(true);
    try {
      const result = await api.inviteTeammate(email.trim());
      setStatus(`Invitation sent to ${result.email}.`);
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send invitation");
    } finally {
      setIsSubmitting(false);
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
      </div>
    </div>
  );
}
