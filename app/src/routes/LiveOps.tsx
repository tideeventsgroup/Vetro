import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ClockIcon, FileIcon, MapPinIcon, RadarIcon, SirenIcon, WarningIcon } from "../components/icons.js";
import { Alert, Incident, IncidentCategory, Shift, useApi } from "../lib/api.js";
import { useTenantSlug } from "../lib/tenant.js";

const POLL_MS = 20_000;

// How many of the most recent incidents to show before pointing an admin at
// the full Incidents log instead — this card is "what just happened", not a
// replacement for that page's filtering/history.
const RECENT_INCIDENTS_LIMIT = 8;

const CATEGORY_LABELS: Record<IncidentCategory, string> = {
  THEFT: "Theft",
  VANDALISM: "Vandalism",
  TRESPASSING: "Trespassing",
  MEDICAL: "Medical",
  FIRE_SAFETY: "Fire / safety",
  EQUIPMENT_FAULT: "Equipment fault",
  SUSPICIOUS_ACTIVITY: "Suspicious activity",
  OTHER: "Other",
};

function timeAgo(value: string): string {
  const ms = Date.now() - new Date(value).getTime();
  const mins = Math.round(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

// Matches the copy an admin actually wants for a check-in due time: "in 12m"
// while there's still time, "any minute" right at the boundary, and once
// past it "overdue" takes over as its own badge instead (see checkCallStatus).
function dueIn(value: string): string {
  const mins = Math.round((new Date(value).getTime() - Date.now()) / 60_000);
  if (mins <= 0) return "any minute";
  if (mins < 60) return `in ${mins}m`;
  return `in ${Math.round(mins / 60)}h`;
}

const CHECK_CALL_DUE_SOON_MS = 10 * 60 * 1000;

function checkCallStatus(shift: Shift): { label: string; className: string } | undefined {
  if (!shift.requiresCheckCalls || !shift.nextCheckCallDueAt) return undefined;
  if (shift.checkCallOverdue) return { label: "Overdue", className: "status-expired" };
  const msUntilDue = new Date(shift.nextCheckCallDueAt).getTime() - Date.now();
  if (msUntilDue <= CHECK_CALL_DUE_SOON_MS) return { label: `Due ${dueIn(shift.nextCheckCallDueAt)}`, className: "status-expiring" };
  return { label: `Due ${dueIn(shift.nextCheckCallDueAt)}`, className: "status-active" };
}

// Dispatch's "what's happening right now" view — every site that's currently
// covered, who's working it, and anything that needs a response (lone-worker
// alerts, overdue check-ins, freshly-filed incidents). No map: GPS pins never
// told an on-site manager anything a site name and an officer list didn't —
// this trades that for a denser, faster-scanning list.
export function LiveOps() {
  const api = useApi();
  const tenant = useTenantSlug();
  const [activeShifts, setActiveShifts] = useState<Shift[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyAlertId, setBusyAlertId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    void load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, []);

  async function load() {
    try {
      const [shifts, alertRows, incidentRows] = await Promise.all([
        api.listActiveShifts(),
        api.listAlerts(),
        api.listIncidents(),
      ]);
      setActiveShifts(shifts);
      setAlerts(alertRows.filter((a) => a.status !== "RESOLVED"));
      setIncidents(incidentRows.slice(0, RECENT_INCIDENTS_LIMIT));
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load live ops data");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAlertAction(alert: Alert) {
    setBusyAlertId(alert.id);
    try {
      await api.updateAlertStatus(alert.id, alert.status === "OPEN" ? "ACKNOWLEDGED" : "RESOLVED");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update this alert");
    } finally {
      setBusyAlertId(undefined);
    }
  }

  const openAlerts = alerts.filter((a) => a.status === "OPEN");
  const checkCallsDue = activeShifts
    .filter((s) => s.requiresCheckCalls && s.nextCheckCallDueAt)
    .sort((a, b) => new Date(a.nextCheckCallDueAt!).getTime() - new Date(b.nextCheckCallDueAt!).getTime());
  const overdueCheckCallCount = checkCallsDue.filter((s) => s.checkCallOverdue).length;

  const activeSites = new Map<string, { name: string; officerNames: string[] }>();
  for (const s of activeShifts) {
    if (!s.site) continue;
    const entry = activeSites.get(s.site.id) ?? { name: s.site.name, officerNames: [] };
    entry.officerNames.push(s.officer ? `${s.officer.firstName} ${s.officer.lastName}` : "Officer");
    activeSites.set(s.site.id, entry);
  }
  const activeSiteList = [...activeSites.values()].sort((a, b) => b.officerNames.length - a.officerNames.length);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Live ops</h1>
          <p>Which sites are covered right now, who's working, and anything that needs a response.</p>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {alerts.length > 0 && (
        <div className="card" style={{ borderLeft: "3px solid var(--vetro-status-red)", marginBottom: 24 }}>
          <div className="card-header">
            <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <SirenIcon />
              {openAlerts.length > 0 ? `${openAlerts.length} alert${openAlerts.length === 1 ? "" : "s"} — needs attention` : "Alerts in progress"}
            </h2>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Officer</th>
                <th>Raised</th>
                <th>Location</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.id}>
                  <td style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {a.type === "SOS" || a.type === "MISSED_CHECK_CALL" ? (
                      <SirenIcon width={14} height={14} />
                    ) : (
                      <WarningIcon width={14} height={14} />
                    )}
                    {a.type === "SOS" ? "SOS" : a.type === "MISSED_CHECK_CALL" ? "Missed check-in" : "No-show"}
                  </td>
                  <td>
                    {a.officer ? `${a.officer.firstName} ${a.officer.lastName}` : "—"}
                  </td>
                  <td>{timeAgo(a.createdAt)}</td>
                  <td>
                    {a.latitude !== null && a.longitude !== null
                      ? `${a.latitude.toFixed(4)}, ${a.longitude.toFixed(4)}`
                      : "No GPS fix"}
                  </td>
                  <td>
                    <span className={`status-badge ${a.status === "OPEN" ? "status-expired" : "status-expiring"}`}>
                      {a.status === "OPEN" ? "Open" : "Acknowledged"}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-primary"
                      onClick={() => handleAlertAction(a)}
                      disabled={busyAlertId === a.id}
                    >
                      {a.status === "OPEN" ? "Acknowledge" : "Resolve"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {checkCallsDue.length > 0 && (
        <div
          className="card"
          style={{
            borderLeft: `3px solid ${overdueCheckCallCount > 0 ? "var(--vetro-status-red)" : "var(--vetro-status-amber)"}`,
            marginBottom: 24,
          }}
        >
          <div className="card-header">
            <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ClockIcon />
              Check calls due
              {overdueCheckCallCount > 0 && <span className="nav-badge">{overdueCheckCallCount}</span>}
            </h2>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Officer</th>
                <th>Site</th>
                <th>Last check-in</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {checkCallsDue.map((shift) => {
                const status = checkCallStatus(shift);
                // lastCheckCallAt is the officer's most recent actual check-in;
                // falls back to clock-in time only if they haven't checked in
                // yet this shift.
                const lastCheckIn = shift.lastCheckCallAt ?? shift.clockInAt;
                return (
                  <tr key={shift.id}>
                    <td>{shift.officer ? `${shift.officer.firstName} ${shift.officer.lastName}` : "—"}</td>
                    <td>{shift.site?.name ?? "—"}</td>
                    <td>{lastCheckIn ? timeAgo(lastCheckIn) : "—"}</td>
                    <td>
                      {status && <span className={`status-badge ${status.className}`}>{status.label}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <MapPinIcon />
            Active sites ({activeSiteList.length})
          </h2>
        </div>
        {isLoading ? (
          <p style={{ color: "var(--vetro-text-muted)" }}>Loading…</p>
        ) : activeSiteList.length === 0 ? (
          <p style={{ color: "var(--vetro-text-muted)", fontSize: 14 }}>No sites are currently covered.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Site</th>
                <th>Officers on site</th>
                <th>Covered by</th>
              </tr>
            </thead>
            <tbody>
              {activeSiteList.map((site) => (
                <tr key={site.name}>
                  <td>{site.name}</td>
                  <td>{site.officerNames.length}</td>
                  <td>{site.officerNames.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <RadarIcon />
            Officers working ({activeShifts.length})
          </h2>
        </div>
        {isLoading ? (
          <p style={{ color: "var(--vetro-text-muted)" }}>Loading…</p>
        ) : activeShifts.length === 0 ? (
          <p style={{ color: "var(--vetro-text-muted)", fontSize: 14 }}>No one is currently clocked in.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Officer</th>
                <th>Site</th>
                <th>Clocked in</th>
                <th>Check calls</th>
              </tr>
            </thead>
            <tbody>
              {activeShifts.map((shift) => {
                const status = checkCallStatus(shift);
                return (
                  <tr key={shift.id}>
                    <td>{shift.officer ? `${shift.officer.firstName} ${shift.officer.lastName}` : "—"}</td>
                    <td>{shift.site?.name ?? "—"}</td>
                    <td>{shift.clockInAt ? timeAgo(shift.clockInAt) : "—"}</td>
                    <td>
                      {status ? (
                        <span className={`status-badge ${status.className}`}>{status.label}</span>
                      ) : (
                        <span style={{ color: "var(--vetro-text-muted)", fontSize: 13 }}>Not required</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FileIcon />
            Recent incidents
          </h2>
          <Link to={`/${tenant}/incidents`} style={{ fontSize: 13 }}>
            View all
          </Link>
        </div>
        {isLoading ? (
          <p style={{ color: "var(--vetro-text-muted)" }}>Loading…</p>
        ) : incidents.length === 0 ? (
          <p style={{ color: "var(--vetro-text-muted)", fontSize: 14 }}>No incidents filed recently.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Officer</th>
                <th>Site</th>
                <th>Occurred</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((incident) => (
                <tr key={incident.id}>
                  <td>{CATEGORY_LABELS[incident.category]}</td>
                  <td>{incident.officer ? `${incident.officer.firstName} ${incident.officer.lastName}` : "—"}</td>
                  <td>{incident.site?.name ?? "—"}</td>
                  <td>{timeAgo(incident.occurredAt)}</td>
                  <td style={{ maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {incident.description}
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
