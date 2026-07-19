import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapPinIcon, UsersIcon } from "../components/icons.js";
import { Shift, Site, useApi } from "../lib/api.js";
import { useTenantSlug } from "../lib/tenant.js";

const POLL_MS = 20_000;

interface SiteOccupancy {
  site: Site;
  onSiteShifts: Shift[];
  pct: number | undefined;
  status: "no-show" | "understaffed" | "staffed" | "no-target";
  offGeofenceCount: number;
}

function classify(site: Site, onSiteShifts: Shift[]): SiteOccupancy {
  const required = site.requiredHeadcount;
  const onSite = onSiteShifts.length;
  const pct = required ? Math.round((onSite / required) * 100) : undefined;
  const offGeofenceCount = onSiteShifts.filter(
    (s) => site.geofenceRadiusM != null && s.clockInDistanceM != null && s.clockInDistanceM > site.geofenceRadiusM
  ).length;

  let status: SiteOccupancy["status"];
  if (!required) status = "no-target";
  else if (onSite === 0) status = "no-show";
  else if (onSite < required) status = "understaffed";
  else status = "staffed";

  return { site, onSiteShifts, pct, status, offGeofenceCount };
}

const STATUS_LABEL: Record<SiteOccupancy["status"], string> = {
  "no-show": "No-show",
  understaffed: "Understaffed",
  staffed: "Fully staffed",
  "no-target": "No target set",
};

const STATUS_CLASS: Record<SiteOccupancy["status"], string> = {
  "no-show": "status-expired",
  understaffed: "status-expiring",
  staffed: "status-active",
  "no-target": "status-neutral",
};

const BAR_COLOR: Record<SiteOccupancy["status"], string> = {
  "no-show": "var(--vetro-status-red)",
  understaffed: "var(--vetro-status-amber)",
  staffed: "var(--vetro-status-green)",
  "no-target": "var(--vetro-border-strong)",
};

// Every site's currently-clocked-in headcount against its target — the
// same active-shift data Live Ops maps, rolled up per site instead of
// plotted on a map. Polls like Live Ops since "who's on site right now"
// changes continuously through the day.
export function Occupancy() {
  const api = useApi();
  const tenant = useTenantSlug();
  const [sites, setSites] = useState<Site[]>([]);
  const [activeShifts, setActiveShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    void load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, []);

  async function load() {
    try {
      const [siteRows, shiftRows] = await Promise.all([api.listSites(), api.listActiveShifts()]);
      setSites(siteRows);
      setActiveShifts(shiftRows);
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load site occupancy");
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) return <p style={{ color: "var(--vetro-text-muted)" }}>Loading…</p>;

  const shiftsBySite = new Map<string, Shift[]>();
  for (const shift of activeShifts) {
    const list = shiftsBySite.get(shift.siteId) ?? [];
    list.push(shift);
    shiftsBySite.set(shift.siteId, list);
  }

  const rows = sites
    .map((site) => classify(site, shiftsBySite.get(site.id) ?? []))
    .sort((a, b) => {
      const rank = { "no-show": 0, understaffed: 1, staffed: 2, "no-target": 3 };
      return rank[a.status] - rank[b.status];
    });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Live Site Occupancy</h1>
          <p>Who's actually on site right now, against each site's expected headcount.</p>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {sites.length === 0 ? (
        <div className="card empty-state">
          <span className="empty-icon">
            <MapPinIcon />
          </span>
          <p>No sites added yet.</p>
        </div>
      ) : (
        <div className="summary-grid">
          {rows.map((row) => (
            <div className="card" key={row.site.id} style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{row.site.name}</div>
                  <div style={{ fontSize: 13, color: "var(--vetro-text-muted)", marginTop: 2 }}>
                    {row.onSiteShifts.length} on site
                    {row.site.requiredHeadcount != null && ` of ${row.site.requiredHeadcount} required`}
                  </div>
                </div>
                <span className={`status-badge ${STATUS_CLASS[row.status]}`}>{STATUS_LABEL[row.status]}</span>
              </div>

              {row.pct !== undefined && (
                <div
                  style={{
                    marginTop: 14,
                    height: 8,
                    borderRadius: 999,
                    background: "var(--vetro-surface-muted)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min(100, row.pct)}%`,
                      background: BAR_COLOR[row.status],
                      borderRadius: 999,
                      transition: "width var(--vetro-duration) var(--vetro-ease)",
                    }}
                  />
                </div>
              )}

              {row.onSiteShifts.length > 0 && (
                <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
                  {row.onSiteShifts.map((shift) => (
                    <div key={shift.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                      <UsersIcon width={13} height={13} style={{ color: "var(--vetro-text-muted)", flexShrink: 0 }} />
                      {shift.officer ? (
                        <Link to={`/${tenant}/officers/${shift.officer.id}`}>
                          {shift.officer.firstName} {shift.officer.lastName}
                        </Link>
                      ) : (
                        "Unknown officer"
                      )}
                      {shift.site?.geofenceRadiusM != null &&
                        shift.clockInDistanceM != null &&
                        shift.clockInDistanceM > shift.site.geofenceRadiusM && (
                          <span style={{ color: "var(--vetro-status-red-text)", fontSize: 12 }}>· off geofence</span>
                        )}
                    </div>
                  ))}
                </div>
              )}

              {row.site.requiredHeadcount == null && (
                <p className="subtle-meta" style={{ marginTop: 12, marginBottom: 0 }}>
                  <Link to={`/${tenant}/sites`}>Set a required headcount</Link> to track occupancy here.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
