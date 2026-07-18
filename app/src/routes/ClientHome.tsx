import { useEffect, useMemo, useState } from "react";
import { ShiftStatusBadge } from "../components/StatusBadge.js";
import { CheckIcon, MapPinIcon, XIcon } from "../components/icons.js";
import { Shift, ShiftStatus, Site, useApi } from "../lib/api.js";

function formatDay(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

const BORDER_COLORS: Record<ShiftStatus, string> = {
  SCHEDULED: "var(--vetro-ink-300)",
  CONFIRMED: "var(--vetro-teal)",
  COMPLETED: "var(--vetro-status-green)",
  MISSED: "var(--vetro-status-red)",
  LATE: "var(--vetro-status-amber)",
};

// Same day-grouped board as Schedule.tsx (kept as its own local copy since
// it's the only other call site) — a site's own contact sees the same
// "who's where, when" shape, just scoped to their one site and with confirm
// actions instead of full shift management.
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

  const days = useMemo(() => groupByDay(shiftsList), [shiftsList]);

  const tally = useMemo(() => {
    const now = Date.now();
    let upcoming = 0;
    let completed = 0;
    let needsAttention = 0;
    for (const shift of shiftsList) {
      if (shift.status === "COMPLETED") completed++;
      else if (shift.status === "MISSED" || shift.status === "LATE") needsAttention++;
      else if (new Date(shift.startTime).getTime() >= now) upcoming++;
    }
    return { upcoming, completed, needsAttention };
  }, [shiftsList]);

  if (isLoading) return <p style={{ color: "var(--vetro-text-muted)" }}>Loading…</p>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{site?.name ?? "Your site"}</h1>
          <p>
            {site?.address ? (
              <>
                <MapPinIcon width={13} height={13} /> {site.address}
              </>
            ) : (
              "Shifts scheduled here — confirm what actually happened."
            )}
          </p>
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
            <div className="count" style={{ color: "#1C7A45" }}>
              {tally.completed}
            </div>
            <div className="label">Completed</div>
          </div>
        </div>
        <div className="summary-tile">
          <div>
            <div className="count" style={{ color: tally.needsAttention > 0 ? "var(--vetro-status-red)" : undefined }}>
              {tally.needsAttention}
            </div>
            <div className="label">Missed or late</div>
          </div>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {days.length === 0 ? (
        <div className="card empty-state">
          <p>No shifts scheduled here yet.</p>
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
                        <div className="shift-card-site">
                          {shift.officer ? `${shift.officer.firstName} ${shift.officer.lastName}` : "Unassigned"}
                        </div>
                        <div className="shift-card-officer">
                          {formatTime(shift.startTime)} – {formatTime(shift.endTime)}
                        </div>
                      </div>
                      <ShiftStatusBadge status={shift.status} />
                    </div>

                    {expandedId === shift.id ? (
                      <div className="shift-card-confirm">
                        <div className="form-field" style={{ marginBottom: 8 }}>
                          <label htmlFor={`notes-${shift.id}`}>Notes (if missed or late)</label>
                          <input
                            id={`notes-${shift.id}`}
                            value={incidentNotes}
                            onChange={(e) => setIncidentNotes(e.target.value)}
                          />
                        </div>
                        <div className="shift-card-footer">
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
                          <button className="btn btn-secondary" onClick={() => toggleExpand(shift)}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="shift-card-footer">
                        <button className="btn btn-secondary" onClick={() => toggleExpand(shift)}>
                          Confirm what happened
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
