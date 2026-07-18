import { Fragment, FormEvent, useEffect, useState } from "react";
import { MailIcon, PlusIcon } from "../components/icons.js";
import { TemporaryPasswordReveal } from "../components/TemporaryPasswordReveal.js";
import { Site, useApi } from "../lib/api.js";

export function Sites() {
  const api = useApi();
  const [sites, setSites] = useState<Site[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddSite, setShowAddSite] = useState(false);
  const [expandedId, setExpandedId] = useState<string | undefined>(undefined);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteStatus, setInviteStatus] = useState<string | undefined>(undefined);
  const [invitedPassword, setInvitedPassword] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setIsLoading(true);
    try {
      setSites(await api.listSites());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load sites");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAddSite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await api.createSite({
      name: String(form.get("name")),
      address: String(form.get("address") || "") || undefined,
      clientContactName: String(form.get("clientContactName") || "") || undefined,
      clientContactEmail: String(form.get("clientContactEmail") || "") || undefined,
    });
    setShowAddSite(false);
    await load();
  }

  function toggleExpand(site: Site) {
    setExpandedId((current) => (current === site.id ? undefined : site.id));
    setInviteEmail(site.clientContactEmail ?? "");
    setInviteStatus(undefined);
    setInvitedPassword(undefined);
  }

  async function handleInviteClient(siteId: string) {
    setInviteStatus(undefined);
    setInvitedPassword(undefined);
    try {
      const result = await api.inviteClient(siteId, inviteEmail.trim() || undefined);
      setInviteStatus(
        `Account created for ${result.email}. Email may not arrive (Cognito's sender is capped at 50/day) — share this temporary password directly if needed:`
      );
      setInvitedPassword(result.temporaryPassword);
      await load();
    } catch (err) {
      setInviteStatus(err instanceof Error ? err.message : "Could not send invitation");
    }
  }

  if (isLoading) return <p style={{ color: "var(--vetro-text-muted)" }}>Loading…</p>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Sites</h1>
          <p>The client sites and contracts your officers are scheduled against.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setShowAddSite((v) => !v)}>
            {!showAddSite && <PlusIcon width={14} height={14} />}
            {showAddSite ? "Cancel" : "Add site"}
          </button>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {showAddSite && (
        <div className="card">
          <form onSubmit={handleAddSite}>
            <div className="form-field">
              <label htmlFor="siteName">Name</label>
              <input id="siteName" name="name" required />
            </div>
            <div className="form-field">
              <label htmlFor="siteAddress">Address (optional)</label>
              <input id="siteAddress" name="address" />
            </div>
            <div className="form-field">
              <label htmlFor="clientContactName">Client contact name (optional)</label>
              <input id="clientContactName" name="clientContactName" />
            </div>
            <div className="form-field">
              <label htmlFor="clientContactEmail">Client contact email (optional)</label>
              <input id="clientContactEmail" name="clientContactEmail" type="email" />
            </div>
            <button className="btn btn-primary" type="submit">
              Save site
            </button>
          </form>
        </div>
      )}

      {sites.length === 0 ? (
        <div className="card empty-state">
          <p>No sites added yet. Add your first site to start scheduling.</p>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Site</th>
              <th>Address</th>
              <th>Client contact</th>
            </tr>
          </thead>
          <tbody>
            {sites.map((site) => (
              <Fragment key={site.id}>
                <tr className="clickable" onClick={() => toggleExpand(site)}>
                  <td>{site.name}</td>
                  <td>{site.address ?? "—"}</td>
                  <td>{site.clientContactEmail ?? "—"}</td>
                </tr>
                {expandedId === site.id && (
                  <tr>
                    <td colSpan={3} style={{ background: "var(--vetro-bg)" }}>
                      <div style={{ padding: "12px 4px" }}>
                        <p style={{ fontSize: 13, marginBottom: 12 }}>
                          Give this site's client contact their own login to review and confirm shifts.
                        </p>
                        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                          <div className="form-field" style={{ marginBottom: 0, minWidth: 240 }}>
                            <label htmlFor={`invite-${site.id}`}>Client email</label>
                            <input
                              id={`invite-${site.id}`}
                              type="email"
                              value={inviteEmail}
                              onChange={(e) => setInviteEmail(e.target.value)}
                            />
                          </div>
                          <button className="btn btn-secondary" onClick={() => handleInviteClient(site.id)}>
                            <MailIcon width={14} height={14} />
                            Send invite
                          </button>
                        </div>
                        {inviteStatus && <p className="subtle-meta">{inviteStatus}</p>}
                        {invitedPassword && <TemporaryPasswordReveal password={invitedPassword} />}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
