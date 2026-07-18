import { useEffect, useState } from "react";
import { Site, VisitorLogEntry, useApi } from "../lib/api.js";

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Read-only admin view across every site — officers sign visitors in/out
// from the self-service portal (routes/MyVisitorLog.tsx); this is the
// compliance/audit side of the same register.
export function VisitorLog() {
  const api = useApi();
  const [entries, setEntries] = useState<VisitorLogEntry[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [siteFilter, setSiteFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    void api.listSites().then(setSites);
  }, []);

  useEffect(() => {
    void load();
  }, [siteFilter]);

  async function load() {
    setIsLoading(true);
    try {
      setEntries(await api.listVisitorLog({ siteId: siteFilter || undefined }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the visitor log");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Visitor log</h1>
          <p>Every visitor signed in or out across your sites.</p>
        </div>
      </div>

      <div className="form-field" style={{ maxWidth: 240 }}>
        <label htmlFor="visitorSiteFilter">Site</label>
        <select id="visitorSiteFilter" value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}>
          <option value="">All sites</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="error-text">{error}</p>}

      {isLoading ? (
        <p style={{ color: "var(--vetro-text-muted)" }}>Loading…</p>
      ) : entries.length === 0 ? (
        <div className="card empty-state">
          <p>No visitor entries yet.</p>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Site</th>
              <th>Visitor</th>
              <th>Company</th>
              <th>Host</th>
              <th>Signed in</th>
              <th>Signed out</th>
              <th>Recorded by</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.site?.name ?? "—"}</td>
                <td>{entry.visitorName}</td>
                <td>{entry.company ?? "—"}</td>
                <td>{entry.hostName ?? "—"}</td>
                <td>{formatDateTime(entry.signedInAt)}</td>
                <td>{entry.signedOutAt ? formatDateTime(entry.signedOutAt) : "—"}</td>
                <td>{entry.officer ? `${entry.officer.firstName} ${entry.officer.lastName}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
