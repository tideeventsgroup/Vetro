import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ClockIcon } from "../components/icons.js";
import { DataRequestStatusBadge } from "../components/StatusBadge.js";
import { DataRequest, useApi } from "../lib/api.js";
import { useTenantSlug } from "../lib/tenant.js";

const TYPE_LABELS: Record<DataRequest["type"], string> = {
  ACCESS: "Access request",
  DELETE: "Deletion request",
};

export function DataRequests() {
  const api = useApi();
  const tenant = useTenantSlug();
  const [requests, setRequests] = useState<DataRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [resolvingId, setResolvingId] = useState<string | undefined>(undefined);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setIsLoading(true);
    try {
      setRequests(await api.listDataRequests());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load data requests");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResolve(request: DataRequest) {
    const verb = request.type === "DELETE" ? "permanently delete this candidate's record" : "mark this access request fulfilled";
    if (!window.confirm(`Are you sure you want to ${verb}?`)) return;
    setResolvingId(request.id);
    try {
      await api.resolveDataRequest(request.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resolve request");
    } finally {
      setResolvingId(undefined);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Data requests</h1>
          <p>GDPR access and deletion requests candidates have raised through their own link.</p>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {isLoading ? (
        <p style={{ color: "var(--lunara-text-muted)" }}>Loading…</p>
      ) : requests.length === 0 ? (
        <div className="card empty-state">
          <span className="empty-icon">
            <ClockIcon />
          </span>
          <p>No data requests yet.</p>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Type</th>
              <th>Requested</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id}>
                <td>
                  {request.candidate ? (
                    <Link to={`/${tenant}/candidates/${request.candidate.id}`}>
                      {request.candidate.firstName} {request.candidate.lastName}
                    </Link>
                  ) : (
                    <span className="subtle-meta">Already deleted</span>
                  )}
                </td>
                <td>{TYPE_LABELS[request.type]}</td>
                <td>{new Date(request.requestedAt).toLocaleDateString("en-GB")}</td>
                <td>
                  <DataRequestStatusBadge status={request.status} />
                </td>
                <td>
                  {request.status === "PENDING" && (
                    <button className="btn btn-secondary" disabled={resolvingId === request.id} onClick={() => handleResolve(request)}>
                      {resolvingId === request.id ? "Resolving…" : "Resolve"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
