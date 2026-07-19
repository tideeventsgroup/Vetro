import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { ClockIcon, RadarIcon, SirenIcon, WarningIcon } from "../components/icons.js";
import { Alert, Shift, useApi } from "../lib/api.js";

const POLL_MS = 20_000;

// Falkirk-ish — a reasonable Scotland-wide fallback centre when there's
// nothing on the map yet to centre on instead.
const FALLBACK_CENTER: [number, number] = [56.0, -3.9];

function divIcon(background: string, size: number) {
  return L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${background};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const OFFICER_ICON = divIcon("#1C7A6B", 16);
const SITE_ICON = divIcon("var(--vetro-ink-500)", 10);
const ALERT_ICON = divIcon("#C4342B", 22);

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

// Dispatch's "where is everyone right now" view — the single feature every
// 2026 buyer's guide (Belfry, Novagems, GuardMetrics) names as the category's
// actual core. Plots every currently clocked-in officer at their live
// position (routes/me.ts's ping, falling back to the clock-in snapshot if a
// ping hasn't landed yet) alongside any open lone-worker SOS alerts.
export function LiveOps() {
  const api = useApi();
  const [activeShifts, setActiveShifts] = useState<Shift[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
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
      const [shifts, alertRows] = await Promise.all([api.listActiveShifts(), api.listAlerts()]);
      setActiveShifts(shifts);
      setAlerts(alertRows.filter((a) => a.status !== "RESOLVED"));
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

  const positioned = activeShifts.filter(
    (s) => (s.lastLat ?? s.clockInLat) !== null && (s.lastLng ?? s.clockInLng) !== null
  );
  const sitePins = new Map<string, { lat: number; lng: number; name: string }>();
  for (const s of activeShifts) {
    if (s.site && s.site.latitude !== null && s.site.longitude !== null && !sitePins.has(s.site.id)) {
      sitePins.set(s.site.id, { lat: s.site.latitude, lng: s.site.longitude, name: s.site.name });
    }
  }
  const openAlerts = alerts.filter((a) => a.status === "OPEN");
  const checkCallsDue = activeShifts
    .filter((s) => s.requiresCheckCalls && s.nextCheckCallDueAt)
    .sort((a, b) => new Date(a.nextCheckCallDueAt!).getTime() - new Date(b.nextCheckCallDueAt!).getTime());
  const overdueCheckCallCount = checkCallsDue.filter((s) => s.checkCallOverdue).length;

  const center: [number, number] =
    positioned.length > 0
      ? [(positioned[0].lastLat ?? positioned[0].clockInLat)!, (positioned[0].lastLng ?? positioned[0].clockInLng)!]
      : FALLBACK_CENTER;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Live ops</h1>
          <p>Every clocked-in officer right now, and any lone-worker alerts that need a response.</p>
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

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ height: 480 }}>
          <MapContainer center={center} zoom={positioned.length > 0 ? 12 : 7} style={{ height: "100%", width: "100%" }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {[...sitePins.entries()].map(([id, site]) => (
              <Marker key={id} position={[site.lat, site.lng]} icon={SITE_ICON}>
                <Popup>{site.name}</Popup>
              </Marker>
            ))}
            {positioned.map((shift) => (
              <Marker
                key={shift.id}
                position={[(shift.lastLat ?? shift.clockInLat)!, (shift.lastLng ?? shift.clockInLng)!]}
                icon={OFFICER_ICON}
              >
                <Popup>
                  {shift.officer ? `${shift.officer.firstName} ${shift.officer.lastName}` : "Officer"}
                  <br />
                  {shift.site?.name}
                  <br />
                  {shift.lastLocationAt ? `Updated ${timeAgo(shift.lastLocationAt)}` : "Position from clock-in"}
                </Popup>
              </Marker>
            ))}
            {openAlerts
              .filter((a) => a.latitude !== null && a.longitude !== null)
              .map((a) => (
                <Marker key={a.id} position={[a.latitude!, a.longitude!]} icon={ALERT_ICON}>
                  <Popup>
                    SOS — {a.officer ? `${a.officer.firstName} ${a.officer.lastName}` : "Officer"}
                    <br />
                    Raised {timeAgo(a.createdAt)}
                  </Popup>
                </Marker>
              ))}
          </MapContainer>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <RadarIcon />
            Clocked in now ({activeShifts.length})
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
                <th>Last position update</th>
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
                    <td>{shift.lastLocationAt ? timeAgo(shift.lastLocationAt) : "No ping yet"}</td>
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
    </div>
  );
}
