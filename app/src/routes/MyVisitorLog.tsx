import { FormEvent, useEffect, useState } from "react";
import { PlusIcon } from "../components/icons.js";
import { Site, VisitorLogEntry, useApi } from "../lib/api.js";

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// A site-level sign-in/out register, common wherever a site controls who's
// allowed past reception — recorded by whichever officer is on duty. The
// list is scoped to the site, not the caller, so the next shift's officer
// can see (and sign out) a visitor an earlier shift signed in.
export function MyVisitorLog() {
  const api = useApi();
  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState("");
  const [entries, setEntries] = useState<VisitorLogEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [visitorName, setVisitorName] = useState("");
  const [company, setCompany] = useState("");
  const [purpose, setPurpose] = useState("");
  const [hostName, setHostName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signingOutId, setSigningOutId] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    void loadSites();
  }, []);

  useEffect(() => {
    if (siteId) void loadEntries();
  }, [siteId]);

  async function loadSites() {
    const rows = await api.listMySites();
    setSites(rows);
    if (rows.length > 0) setSiteId(rows[0].id);
    else setIsLoading(false);
  }

  async function loadEntries() {
    setIsLoading(true);
    try {
      setEntries(await api.listMyVisitorLog(siteId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the visitor log");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    if (!visitorName.trim()) return;
    setIsSubmitting(true);
    setError(undefined);
    try {
      await api.signInVisitor({
        siteId,
        visitorName: visitorName.trim(),
        company: company.trim() || undefined,
        purpose: purpose.trim() || undefined,
        hostName: hostName.trim() || undefined,
      });
      setVisitorName("");
      setCompany("");
      setPurpose("");
      setHostName("");
      setShowForm(false);
      await loadEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in this visitor");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignOut(id: string) {
    setSigningOutId(id);
    setError(undefined);
    try {
      await api.signOutVisitor(id);
      await loadEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign out this visitor");
    } finally {
      setSigningOutId(undefined);
    }
  }

  const currentlyIn = entries.filter((e) => !e.signedOutAt);
  const history = entries.filter((e) => e.signedOutAt);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Visitor log</h1>
          <p>Sign visitors in and out at your site.</p>
        </div>
        {sites.length > 0 && (
          <div className="page-actions">
            <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
              {!showForm && <PlusIcon width={14} height={14} />}
              {showForm ? "Cancel" : "Sign in visitor"}
            </button>
          </div>
        )}
      </div>

      {sites.length === 0 ? (
        <div className="card empty-state">
          <p>You need a shift at a site before you can log visitors there.</p>
        </div>
      ) : (
        <>
          <div className="form-field" style={{ maxWidth: 280 }}>
            <label htmlFor="visitorSite">Site</label>
            <select id="visitorSite" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="error-text">{error}</p>}

          {showForm && (
            <div className="card">
              <form onSubmit={handleSignIn}>
                <div className="form-field">
                  <label htmlFor="visitorName">Visitor name</label>
                  <input id="visitorName" value={visitorName} onChange={(e) => setVisitorName(e.target.value)} required />
                </div>
                <div className="form-field">
                  <label htmlFor="visitorCompany">Company (optional)</label>
                  <input id="visitorCompany" value={company} onChange={(e) => setCompany(e.target.value)} />
                </div>
                <div className="form-field">
                  <label htmlFor="visitorPurpose">Purpose of visit (optional)</label>
                  <input id="visitorPurpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
                </div>
                <div className="form-field">
                  <label htmlFor="visitorHost">Visiting who (optional)</label>
                  <input id="visitorHost" value={hostName} onChange={(e) => setHostName(e.target.value)} />
                </div>
                <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Signing in…" : "Sign in"}
                </button>
              </form>
            </div>
          )}

          {isLoading ? (
            <p style={{ color: "var(--vetro-text-muted)" }}>Loading…</p>
          ) : (
            <>
              <div className="card">
                <div className="card-header">
                  <h2>Currently on site</h2>
                </div>
                {currentlyIn.length === 0 ? (
                  <p style={{ color: "var(--vetro-text-muted)", fontSize: 14 }}>No visitors currently signed in.</p>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Visitor</th>
                        <th>Company</th>
                        <th>Signed in</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentlyIn.map((entry) => (
                        <tr key={entry.id}>
                          <td>{entry.visitorName}</td>
                          <td>{entry.company ?? "—"}</td>
                          <td>{formatDateTime(entry.signedInAt)}</td>
                          <td>
                            <button
                              className="btn btn-secondary"
                              onClick={() => handleSignOut(entry.id)}
                              disabled={signingOutId === entry.id}
                            >
                              {signingOutId === entry.id ? "Signing out…" : "Sign out"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {history.length > 0 && (
                <div className="card">
                  <div className="card-header">
                    <h2>Recent history</h2>
                  </div>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Visitor</th>
                        <th>Company</th>
                        <th>Signed in</th>
                        <th>Signed out</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((entry) => (
                        <tr key={entry.id}>
                          <td>{entry.visitorName}</td>
                          <td>{entry.company ?? "—"}</td>
                          <td>{formatDateTime(entry.signedInAt)}</td>
                          <td>{entry.signedOutAt ? formatDateTime(entry.signedOutAt) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
