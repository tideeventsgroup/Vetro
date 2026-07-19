import { ReactNode, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckIcon, ShieldCheckIcon, SirenIcon, WarningIcon } from "../components/icons.js";
import { Alert, Officer, useApi } from "../lib/api.js";
import { useTenantSlug } from "../lib/tenant.js";
import { worstStatus, worstVettingRecord } from "../lib/status.js";

const RECENT_RESOLVED_LIMIT = 10;

function timeAgo(value: string): string {
  const ms = Date.now() - new Date(value).getTime();
  const mins = Math.round(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / (60 * 24))}d ago`;
}

interface AlertItem {
  key: string;
  icon: ReactNode;
  title: string;
  detail: string;
  time: string;
  action?: { label: string; onClick: () => void; busy: boolean };
}

interface AlertGroup {
  key: string;
  label: string;
  dotColor: string;
  items: AlertItem[];
}

// A single severity-grouped feed over every notable compliance/safety event
// Vetro actually tracks — real Alert records (SOS/no-show) plus officers
// whose licence or vetting is heading towards expiry. Unlike Live Ops (which
// is the real-time "what's happening right now" map + action queue), this
// is the browsable history: what happened, grouped by how urgent it was.
export function Alerts() {
  const api = useApi();
  const tenant = useTenantSlug();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [busyAlertId, setBusyAlertId] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setIsLoading(true);
    try {
      const [alertRows, officerRows] = await Promise.all([api.listAlerts(), api.listOfficers()]);
      setAlerts(alertRows);
      setOfficers(officerRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load alerts");
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

  if (isLoading) return <p style={{ color: "var(--vetro-text-muted)" }}>Loading…</p>;

  function alertItem(a: Alert): AlertItem {
    const name = a.officer ? `${a.officer.firstName} ${a.officer.lastName}` : "Unknown officer";
    const icon =
      a.type === "SOS" || a.type === "MISSED_CHECK_CALL" ? (
        <SirenIcon width={16} height={16} />
      ) : a.type === "CHECK_CALL" ? (
        <CheckIcon width={16} height={16} />
      ) : (
        <WarningIcon width={16} height={16} />
      );
    const title =
      a.type === "SOS"
        ? `SOS raised — ${name}`
        : a.type === "MISSED_CHECK_CALL"
          ? `Missed check-in — ${name}`
          : a.type === "CHECK_CALL"
            ? `Check-in confirmed — ${name}`
            : `No-show — ${name}`;
    return {
      key: a.id,
      icon,
      title,
      detail:
        a.type === "CHECK_CALL"
          ? "Welfare check-in — no action needed"
          : a.status === "RESOLVED"
            ? `Resolved${a.acknowledgedByEmail ? ` by ${a.acknowledgedByEmail}` : ""}`
            : a.type === "MISSED_CHECK_CALL"
              ? "Hourly check-in is over 30 minutes overdue"
              : a.latitude !== null && a.longitude !== null
                ? `${a.latitude.toFixed(4)}, ${a.longitude.toFixed(4)}`
                : "No GPS fix",
      time: timeAgo(a.createdAt),
      action:
        a.status === "RESOLVED"
          ? undefined
          : {
              label: a.status === "OPEN" ? "Acknowledge" : "Resolve",
              onClick: () => handleAlertAction(a),
              busy: busyAlertId === a.id,
            },
    };
  }

  const openAlerts = alerts.filter((a) => a.status === "OPEN");
  const acknowledgedAlerts = alerts.filter((a) => a.status === "ACKNOWLEDGED");
  const resolvedAlerts = alerts
    .filter((a) => a.status === "RESOLVED")
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, RECENT_RESOLVED_LIMIT);

  const expiringOfficers = officers.filter((o) => worstStatus(o) === "EXPIRING");

  const groups: AlertGroup[] = [
    {
      key: "critical",
      label: "Critical",
      dotColor: "var(--vetro-status-red-text)",
      items: openAlerts.map(alertItem),
    },
    {
      key: "warning",
      label: "Warning",
      dotColor: "var(--vetro-status-amber-text)",
      items: [
        ...acknowledgedAlerts.map(alertItem),
        ...expiringOfficers.map((o) => {
          const record = worstVettingRecord(o.vettingRecords);
          const licence = o.licences.find((l) => l.status === "EXPIRING");
          const expiryDate = record?.expiryDate ?? licence?.expiryDate;
          return {
            key: `expiring-${o.id}`,
            icon: <ShieldCheckIcon width={16} height={16} />,
            title: `Vetting expiring soon — ${o.firstName} ${o.lastName}`,
            detail: expiryDate
              ? `Expires ${new Date(expiryDate).toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" })}`
              : "Check licence/vetting records",
            time: "",
          } satisfies AlertItem;
        }),
      ],
    },
    {
      key: "info",
      label: "Info",
      dotColor: "var(--vetro-badge-blue-text)",
      items: resolvedAlerts.map(alertItem),
    },
  ];

  const totalItems = groups.reduce((sum, g) => sum + g.items.length, 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Alerts Center</h1>
          <p>Every safety and compliance event that needs attention, grouped by severity.</p>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {totalItems === 0 ? (
        <div className="card empty-state">
          <span className="empty-icon">
            <CheckIcon />
          </span>
          <p>Nothing to show — no open alerts or upcoming expiries.</p>
        </div>
      ) : (
        groups
          .filter((g) => g.items.length > 0)
          .map((g) => (
            <div className="card" key={g.key}>
              <div className="card-header">
                <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: g.dotColor, display: "inline-block" }} />
                  {g.label} ({g.items.length})
                </h2>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {g.items.map((item) => (
                  <div
                    key={item.key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: "12px 4px",
                      borderBottom: "1px solid var(--vetro-border)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                      <span style={{ color: "var(--vetro-text-muted)", flexShrink: 0 }}>{item.icon}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{item.title}</div>
                        <div style={{ fontSize: 12, color: "var(--vetro-text-muted)" }}>
                          {item.detail}
                          {item.time && ` · ${item.time}`}
                        </div>
                      </div>
                    </div>
                    {item.action && (
                      <button className="btn btn-primary" disabled={item.action.busy} onClick={item.action.onClick} style={{ flexShrink: 0 }}>
                        {item.action.label}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
      )}

      <p className="subtle-meta">
        Live, map-based tracking of currently clocked-in officers lives on{" "}
        <Link to={`/${tenant}`}>Live ops</Link>.
      </p>
    </div>
  );
}
