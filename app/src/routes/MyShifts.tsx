import { useEffect, useMemo, useState } from "react";
import { ShiftStatusBadge } from "../components/StatusBadge.js";
import { CheckIcon, ClockIcon, MapPinIcon } from "../components/icons.js";
import { Shift, ShiftStatus, useApi } from "../lib/api.js";
import { getGpsPosition } from "../lib/geo.js";

function formatDay(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

// How often to refresh the admin Live Ops map's "where are you now" position
// while an officer is clocked in — distinct from the one-time clock-in/out
// GPS snapshots, which never move again once recorded.
const PING_INTERVAL_MS = 90_000;

const BORDER_COLORS: Record<ShiftStatus, string> = {
  SCHEDULED: "var(--vetro-ink-300)",
  CONFIRMED: "var(--vetro-teal)",
  COMPLETED: "var(--vetro-status-green)",
  MISSED: "var(--vetro-status-red)",
  LATE: "var(--vetro-status-amber)",
};

// Same day-grouped board as Schedule.tsx/ClientHome.tsx (kept as its own
// local copy — the only shared piece across all three would be this one
// function, not worth a module for).
function groupByDay(shifts: Shift[]): Array<[string, Shift[]]> {
  const groups = new Map<string, Shift[]>();
  for (const shift of shifts) {
    const key = new Date(shift.startTime).toDateString();
    const existing = groups.get(key);
    if (existing) existing.push(shift);
    else groups.set(key, [shift]);
  }
  return [...groups.entries()].sort(
    (a, b) => new Date(a[1][0].startTime).getTime() - new Date(b[1][0].startTime).getTime()
  );
}

// An officer's own rota — every staff-facing scheduling app treats "what's
// my next shift" as the baseline feature. Confirming a shift here just
// means "I've seen this and I'm coming"; reporting what actually happened
// stays with the site's own client contact (ClientHome.tsx) so the two
// never fight over the same status.
export function MyShifts() {
  const api = useApi();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setIsLoading(true);
    try {
      setShifts(await api.listMyShifts());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your shifts");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleConfirm(shift: Shift) {
    setBusyId(shift.id);
    setError(undefined);
    try {
      await api.confirmMyShift(shift.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm this shift");
    } finally {
      setBusyId(undefined);
    }
  }

  async function handleClockIn(shift: Shift) {
    setBusyId(shift.id);
    setError(undefined);
    try {
      const gps = await getGpsPosition();
      await api.clockInMyShift(shift.id, gps);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not clock in");
    } finally {
      setBusyId(undefined);
    }
  }

  async function handleClockOut(shift: Shift) {
    setBusyId(shift.id);
    setError(undefined);
    try {
      const gps = await getGpsPosition();
      await api.clockOutMyShift(shift.id, gps);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not clock out");
    } finally {
      setBusyId(undefined);
    }
  }

  const activeShift = useMemo(() => shifts.find((s) => s.clockInAt && !s.clockOutAt), [shifts]);

  useEffect(() => {
    if (!activeShift) return;
    const id = activeShift.id;

    async function ping() {
      const gps = await getGpsPosition();
      if (gps?.lat === undefined || gps?.lng === undefined) return;
      try {
        await api.pingMyShiftLocation(id, { lat: gps.lat, lng: gps.lng, accuracyM: gps.accuracyM });
      } catch {
        // Best-effort — a missed ping just leaves a stale position on the
        // admin's Live Ops map until the next one lands, nothing to surface.
      }
    }
    void ping();
    const interval = setInterval(ping, PING_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [activeShift?.id]);

  const days = useMemo(() => groupByDay(shifts), [shifts]);

  const tally = useMemo(() => {
    const now = Date.now();
    let upcoming = 0;
    let needsConfirmation = 0;
    let completed = 0;
    for (const shift of shifts) {
      if (shift.status === "COMPLETED") completed++;
      else if (shift.status === "SCHEDULED") {
        needsConfirmation++;
        if (new Date(shift.startTime).getTime() >= now) upcoming++;
      } else if (new Date(shift.startTime).getTime() >= now) upcoming++;
    }
    return { upcoming, needsConfirmation, completed };
  }, [shifts]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>My shifts</h1>
          <p>Where you're working, and when — confirm any shift you haven't yet.</p>
        </div>
      </div>

      <div className="summary-grid">
        <div className="summary-tile">
          <div>
            <div className="count">{tally.upcoming}</div>
            <div className="label">Upcoming</div>
          </div>
        </div>
        <div className="summary-tile">
          <div>
            <div className="count" style={{ color: tally.needsConfirmation > 0 ? "var(--vetro-status-amber)" : undefined }}>
              {tally.needsConfirmation}
            </div>
            <div className="label">Needs confirmation</div>
          </div>
        </div>
        <div className="summary-tile">
          <div>
            <div className="count" style={{ color: "#1C7A45" }}>
              {tally.completed}
            </div>
            <div className="label">Completed</div>
          </div>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {isLoading ? (
        <p style={{ color: "var(--vetro-text-muted)" }}>Loading…</p>
      ) : days.length === 0 ? (
        <div className="card empty-state">
          <p>No shifts scheduled for you yet.</p>
        </div>
      ) : (
        <div className="schedule-board">
          {days.map(([dateKey, dayShifts]) => (
            <div className="schedule-day" key={dateKey}>
              <h3 className="schedule-day-heading">{formatDay(dayShifts[0].startTime)}</h3>
              <div className="schedule-day-shifts">
                {dayShifts.map((shift) => (
                  <div className="shift-card" key={shift.id} style={{ borderLeftColor: BORDER_COLORS[shift.status] }}>
                    <div className="shift-card-header">
                      <div>
                        <div className="shift-card-site">{shift.site?.name ?? "—"}</div>
                        {shift.site?.address && (
                          <div className="shift-card-officer">
                            <MapPinIcon width={12} height={12} /> {shift.site.address}
                          </div>
                        )}
                      </div>
                      <ShiftStatusBadge status={shift.status} />
                    </div>
                    <div className="shift-card-time">
                      {formatTime(shift.startTime)} – {formatTime(shift.endTime)}
                    </div>
                    {shift.clockInAt && (
                      <p className="subtle-meta" style={{ margin: 0 }}>
                        <ClockIcon width={12} height={12} />
                        {shift.clockOutAt
                          ? `Worked ${formatTime(shift.clockInAt)} – ${formatTime(shift.clockOutAt)}`
                          : `Clocked in at ${formatTime(shift.clockInAt)}`}
                        {shift.clockInDistanceM !== null && " · GPS verified on site"}
                      </p>
                    )}
                    {shift.status === "SCHEDULED" && (
                      <div className="shift-card-footer">
                        <button
                          className="btn btn-primary"
                          onClick={() => handleConfirm(shift)}
                          disabled={busyId === shift.id}
                          style={{ width: "100%" }}
                        >
                          <CheckIcon width={14} height={14} />
                          {busyId === shift.id ? "Confirming…" : "Confirm shift"}
                        </button>
                      </div>
                    )}
                    {shift.status === "CONFIRMED" && !shift.clockInAt && (
                      <div className="shift-card-footer">
                        <button
                          className="btn btn-primary"
                          onClick={() => handleClockIn(shift)}
                          disabled={busyId === shift.id}
                          style={{ width: "100%" }}
                        >
                          <ClockIcon width={14} height={14} />
                          {busyId === shift.id ? "Clocking in…" : "Clock in"}
                        </button>
                      </div>
                    )}
                    {shift.clockInAt && !shift.clockOutAt && (
                      <div className="shift-card-footer">
                        <button
                          className="btn btn-secondary"
                          onClick={() => handleClockOut(shift)}
                          disabled={busyId === shift.id}
                          style={{ width: "100%" }}
                        >
                          {busyId === shift.id ? "Clocking out…" : "Clock out"}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
