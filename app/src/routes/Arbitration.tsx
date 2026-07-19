import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { WarningIcon } from "../components/icons.js";
import { Officer, Shift, Site, useApi } from "../lib/api.js";
import { useTenantSlug } from "../lib/tenant.js";

// How far a clock-in/clock-out can drift from the scheduled time before
// it's flagged for a human to look at, rather than auto-approved.
const TOLERANCE_MIN = 10;
const LOOKBACK_DAYS = 14;

type ArbitrationStatus = "approved" | "flagged";

interface ArbitrationRow {
  shift: Shift;
  deltaLabel: string;
  deltaTone: "neutral" | "amber" | "red";
  reason: string;
  status: ArbitrationStatus;
}

function fmtDelta(min: number): string {
  if (min === 0) return "0m";
  return `${min > 0 ? "+" : ""}${min}m`;
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtRange(startIso: string, endIso: string | null): string {
  return `${fmtTime(startIso)} – ${fmtTime(endIso)}`;
}

// Classifies a completed (or overdue) shift by comparing scheduled vs
// actual clock times — no backend changes needed, this reads straight off
// Shift.startTime/endTime/clockInAt/clockOutAt. Returns null for shifts
// that haven't happened yet (nothing to arbitrate).
function classifyShift(shift: Shift): ArbitrationRow | null {
  if (!shift.officerId) return null;
  const scheduledEnd = new Date(shift.endTime);
  const now = new Date();
  const hasClockIn = Boolean(shift.clockInAt);
  const hasClockOut = Boolean(shift.clockOutAt);

  if (!hasClockIn && scheduledEnd > now) return null;
  if (hasClockIn && !hasClockOut && scheduledEnd > now) return null;

  if (!hasClockIn) {
    return { shift, deltaLabel: "—", deltaTone: "red", reason: "No-show — never clocked in", status: "flagged" };
  }

  const clockInDeltaMin = Math.round((+new Date(shift.clockInAt!) - +new Date(shift.startTime)) / 60_000);

  if (!hasClockOut) {
    return {
      shift,
      deltaLabel: fmtDelta(clockInDeltaMin),
      deltaTone: "amber",
      reason: "Missing check-off record",
      status: "flagged",
    };
  }

  const clockOutDeltaMin = Math.round((+new Date(shift.clockOutAt!) - +scheduledEnd) / 60_000);

  if (clockInDeltaMin > TOLERANCE_MIN) {
    return {
      shift,
      deltaLabel: fmtDelta(clockInDeltaMin),
      deltaTone: "amber",
      reason: "Late clock-in, exceeds tolerance",
      status: "flagged",
    };
  }
  if (clockOutDeltaMin < -TOLERANCE_MIN) {
    return {
      shift,
      deltaLabel: fmtDelta(clockOutDeltaMin),
      deltaTone: "red",
      reason: "Early clock-off, exceeds tolerance",
      status: "flagged",
    };
  }
  const primary = Math.abs(clockOutDeltaMin) >= Math.abs(clockInDeltaMin) ? clockOutDeltaMin : clockInDeltaMin;
  return { shift, deltaLabel: fmtDelta(primary), deltaTone: "neutral", reason: "Within tolerance", status: "approved" };
}

const DELTA_COLOR: Record<ArbitrationRow["deltaTone"], string> = {
  neutral: "var(--vetro-text-secondary)",
  amber: "var(--vetro-status-amber-text)",
  red: "var(--vetro-status-red-text)",
};

// Compares each recently-worked shift's scheduled time against its actual
// clock-in/out and auto-classifies the variance — only genuine exceptions
// (late, early, missing, no-show) need a human decision; everything within
// tolerance is auto-approved and shown collapsed below.
export function Arbitration() {
  const api = useApi();
  const tenant = useTenantSlug();
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setIsLoading(true);
    try {
      const now = new Date();
      const from = new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000).toISOString();
      const [officerRows, siteRows, shiftRows] = await Promise.all([
        api.listOfficers(),
        api.listSites(),
        api.listShifts({ from, to: now.toISOString() }),
      ]);
      setOfficers(officerRows);
      setSites(siteRows);
      setShifts(shiftRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the arbitration queue");
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) return <p style={{ color: "var(--vetro-text-muted)" }}>Loading…</p>;

  const officerById = new Map(officers.map((o) => [o.id, o]));
  const siteById = new Map(sites.map((s) => [s.id, s]));
  const rows = shifts
    .map(classifyShift)
    .filter((r): r is ArbitrationRow => r !== null)
    .sort((a, b) => +new Date(b.shift.startTime) - +new Date(a.shift.startTime));
  const flagged = rows.filter((r) => r.status === "flagged");
  const approved = rows.filter((r) => r.status === "approved");

  function renderRows(list: ArbitrationRow[]) {
    return (
      <table className="data-table">
        <thead>
          <tr>
            <th>Operative</th>
            <th>Site</th>
            <th>Scheduled</th>
            <th>Actual</th>
            <th>Delta</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          {list.map((r) => {
            const officer = r.shift.officerId ? officerById.get(r.shift.officerId) : undefined;
            const site = siteById.get(r.shift.siteId);
            return (
              <tr key={r.shift.id}>
                <td>
                  {officer ? (
                    <Link to={`/${tenant}/officers/${officer.id}`}>
                      {officer.firstName} {officer.lastName}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td>{site?.name ?? "—"}</td>
                <td>{fmtRange(r.shift.startTime, r.shift.endTime)}</td>
                <td>{r.shift.clockInAt || r.shift.clockOutAt ? `${fmtTime(r.shift.clockInAt)} – ${fmtTime(r.shift.clockOutAt)}` : "—"}</td>
                <td style={{ color: DELTA_COLOR[r.deltaTone], fontWeight: 600 }}>{r.deltaLabel}</td>
                <td>{r.reason}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Arbitration Queue</h1>
          <p>Scheduled-vs-actual exceptions from clock-in/out data, sorted by most recent shift.</p>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {flagged.length === 0 ? (
        <div className="card empty-state">
          <span className="empty-icon">
            <WarningIcon />
          </span>
          <p>No exceptions — every worked shift in the last {LOOKBACK_DAYS} days is within tolerance.</p>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <h2>Needs review ({flagged.length})</h2>
          </div>
          {renderRows(flagged)}
        </div>
      )}

      {approved.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2>Auto-approved ({approved.length})</h2>
          </div>
          {renderRows(approved)}
        </div>
      )}
    </div>
  );
}
