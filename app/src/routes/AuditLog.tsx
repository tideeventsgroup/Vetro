import { useEffect, useState } from "react";
import { ClockIcon } from "../components/icons.js";
import { AuditLogEntry, useApi } from "../lib/api.js";

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Every write already lands in AuditLogEntry (backend/src/lib/audit.ts) —
// this is just the read-back an ACS inspector or client due-diligence
// request actually asks for.
export function AuditLog() {
  const api = useApi();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    api
      .listAuditLog()
      .then(setEntries)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load audit log"))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Audit log</h1>
          <p>The most recent 200 changes made in this organisation.</p>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {isLoading ? (
        <p style={{ color: "var(--vetro-text-muted)" }}>Loading…</p>
      ) : entries.length === 0 ? (
        <div className="card empty-state">
          <span className="empty-icon">
            <ClockIcon />
          </span>
          <p>No activity recorded yet.</p>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th>Action</th>
              <th>Entity</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>{formatDateTime(entry.createdAt)}</td>
                <td>{entry.actorEmail}</td>
                <td>{entry.action}</td>
                <td>
                  {entry.entityType} · {entry.entityId.slice(0, 8)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
