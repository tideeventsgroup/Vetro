import { Fragment, useEffect, useState } from "react";
import { ShiftStatusBadge } from "../components/StatusBadge.js";
import { CheckIcon, MapPinIcon, XIcon } from "../components/icons.js";
import { Shift, Site, useApi } from "../lib/api.js";

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// A site's own contact — scoped entirely to their one Site (custom:site_id,
// see requireClientSelf in backend/src/lib/auth.ts). They see shifts
// scheduled here and confirm what actually happened; they never see the
// contractor's roster, other sites, or officer compliance data.
export function ClientHome() {
  const api = useApi();
  const [site, setSite] = useState<Site | undefined>(undefined);
  const [shiftsList, setShiftsList] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | undefined>(undefined);
  const [incidentNotes, setIncidentNotes] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setIsLoading(true);
    try {
      const [siteRow, shiftRows] = await Promise.all([api.getClientSite(), api.listClientShifts()]);
      setSite(siteRow);
      setShiftsList(shiftRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your site");
    } finally {
      setIsLoading(false);
    }
  }

  function toggleExpand(shift: Shift) {
    setExpandedId((current) => (current === shift.id ? undefined : shift.id));
    setIncidentNotes("");
  }

  async function handleConfirm(shift: Shift, status: "COMPLETED" | "MISSED" | "LATE") {
    setError(undefined);
    try {
      await api.confirmClientShift(shift.id, {
        status,
        incidentNotes: status === "COMPLETED" ? undefined : incidentNotes.trim() || undefined,
      });
      setExpandedId(undefined);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  }

  if (isLoading) return <p style={{ color: "var(--vetro-text-muted)" }}>Loading…</p>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{site?.name ?? "Your site"}</h1>
          <p>Shifts scheduled here — confirm what actually happened.</p>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {site?.address && (
        <p className="subtle-meta" style={{ marginBottom: 16 }}>
          <MapPinIcon width={14} height={14} /> {site.address}
        </p>
      )}

      {shiftsList.length === 0 ? (
        <div className="card empty-state">
          <p>No shifts scheduled here yet.</p>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Officer</th>
              <th>Start</th>
              <th>End</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {shiftsList.map((shift) => (
              <Fragment key={shift.id}>
                <tr className="clickable" onClick={() => toggleExpand(shift)}>
                  <td>{shift.officer ? `${shift.officer.firstName} ${shift.officer.lastName}` : "Unassigned"}</td>
                  <td>{formatDateTime(shift.startTime)}</td>
                  <td>{formatDateTime(shift.endTime)}</td>
                  <td>
                    <ShiftStatusBadge status={shift.status} />
                  </td>
                </tr>
                {expandedId === shift.id && (
                  <tr>
                    <td colSpan={4} style={{ background: "var(--vetro-bg)" }}>
                      <div style={{ padding: "12px 4px", display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                        <div className="form-field" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}>
                          <label htmlFor={`notes-${shift.id}`}>Notes (if missed or late)</label>
                          <input
                            id={`notes-${shift.id}`}
                            value={incidentNotes}
                            onChange={(e) => setIncidentNotes(e.target.value)}
                          />
                        </div>
                        <button className="btn btn-primary" onClick={() => handleConfirm(shift, "COMPLETED")}>
                          <CheckIcon width={14} height={14} />
                          Completed
                        </button>
                        <button className="btn btn-secondary" onClick={() => handleConfirm(shift, "LATE")}>
                          Late
                        </button>
                        <button className="btn btn-secondary" onClick={() => handleConfirm(shift, "MISSED")}>
                          <XIcon width={14} height={14} />
                          Missed
                        </button>
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
