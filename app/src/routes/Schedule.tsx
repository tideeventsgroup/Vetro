import { FormEvent, useEffect, useMemo, useState } from "react";
import { ShiftStatusBadge } from "../components/StatusBadge.js";
import { PlusIcon, TrashIcon } from "../components/icons.js";
import { Officer, Shift, ShiftStatus, Site, useApi } from "../lib/api.js";

const STATUS_OPTIONS: ShiftStatus[] = ["SCHEDULED", "CONFIRMED", "COMPLETED", "MISSED", "LATE"];

const BORDER_COLORS: Record<ShiftStatus, string> = {
  SCHEDULED: "var(--vetro-ink-300)",
  CONFIRMED: "var(--vetro-teal)",
  COMPLETED: "var(--vetro-status-green)",
  MISSED: "var(--vetro-status-red)",
  LATE: "var(--vetro-status-amber)",
};

type RangeFilter = "today" | "week" | "all";

function rangeBounds(range: RangeFilter): { from?: string; to?: string } {
  if (range === "all") return {};
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = range === "today" ? 1 : 7;
  const end = new Date(start);
  end.setDate(end.getDate() + days);
  return { from: start.toISOString(), to: end.toISOString() };
}

function formatDay(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

// Grouped by calendar day, shift cards colour-coded by status — the
// TimeGate-style "who's where, at a glance" board, in place of the flat
// table this used to be. Officer compliance risk still lives on the
// Dashboard/Reports; this page answers "who's working, when, and did it
// happen" only.
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

export function Schedule() {
  const api = useApi();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [siteFilter, setSiteFilter] = useState("");
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>("week");
  const [isLoading, setIsLoading] = useState(true);
  const [showAddShift, setShowAddShift] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    void loadReference();
  }, []);

  useEffect(() => {
    void loadShifts();
  }, [siteFilter, rangeFilter]);

  async function loadReference() {
    const [siteRows, officerRows] = await Promise.all([api.listSites(), api.listOfficers()]);
    setSites(siteRows);
    setOfficers(officerRows);
  }

  async function loadShifts() {
    setIsLoading(true);
    try {
      setShifts(await api.listShifts({ siteId: siteFilter || undefined, ...rangeBounds(rangeFilter) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load schedule");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAddShift(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await api.createShift({
      siteId: String(form.get("siteId")),
      officerId: String(form.get("officerId") || "") || undefined,
      startTime: String(form.get("startTime")),
      endTime: String(form.get("endTime")),
    });
    setShowAddShift(false);
    await loadShifts();
  }

  async function handleStatusChange(shift: Shift, status: ShiftStatus) {
    await api.updateShift(shift.id, { status });
    await loadShifts();
  }

  async function handleDelete(shift: Shift) {
    if (!window.confirm("Remove this shift?")) return;
    await api.deleteShift(shift.id);
    await loadShifts();
  }

  const days = useMemo(() => groupByDay(shifts), [shifts]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Roster &amp; scheduling</h1>
          <p>Who's working where, and whether it happened.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setShowAddShift((v) => !v)} disabled={sites.length === 0}>
            {!showAddShift && <PlusIcon width={14} height={14} />}
            {showAddShift ? "Cancel" : "Add shift"}
          </button>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {sites.length === 0 ? (
        <div className="card empty-state">
          <p>Add a site first, then you can schedule shifts against it.</p>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
            <div className="form-field" style={{ marginBottom: 0, maxWidth: 240 }}>
              <label htmlFor="siteFilter">Site</label>
              <select id="siteFilter" value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}>
                <option value="">All sites</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="segmented-control">
              {(["today", "week", "all"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  className={rangeFilter === r ? "active" : ""}
                  onClick={() => setRangeFilter(r)}
                >
                  {r === "today" ? "Today" : r === "week" ? "This week" : "All"}
                </button>
              ))}
            </div>
          </div>

          {showAddShift && (
            <div className="card">
              <form onSubmit={handleAddShift}>
                <div className="form-field">
                  <label htmlFor="siteId">Site</label>
                  <select id="siteId" name="siteId" required defaultValue={siteFilter}>
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label htmlFor="officerId">Officer (optional)</label>
                  <select id="officerId" name="officerId" defaultValue="">
                    <option value="">Unassigned</option>
                    {officers.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.firstName} {o.lastName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label htmlFor="startTime">Start</label>
                  <input id="startTime" name="startTime" type="datetime-local" required />
                </div>
                <div className="form-field">
                  <label htmlFor="endTime">End</label>
                  <input id="endTime" name="endTime" type="datetime-local" required />
                </div>
                <button className="btn btn-primary" type="submit">
                  Save shift
                </button>
              </form>
            </div>
          )}

          {isLoading ? (
            <p style={{ color: "var(--vetro-text-muted)" }}>Loading…</p>
          ) : days.length === 0 ? (
            <div className="card empty-state">
              <p>No shifts scheduled in this range.</p>
            </div>
          ) : (
            <div className="schedule-board">
              {days.map(([dateKey, dayShifts]) => (
                <div className="schedule-day" key={dateKey}>
                  <h3 className="schedule-day-heading">{formatDay(dayShifts[0].startTime)}</h3>
                  <div className="schedule-day-shifts">
                    {dayShifts.map((shift) => (
                      <div
                        className="shift-card"
                        key={shift.id}
                        style={{ borderLeftColor: BORDER_COLORS[shift.status] }}
                      >
                        <div className="shift-card-header">
                          <div>
                            <div className="shift-card-site">{shift.site?.name ?? "—"}</div>
                            <div className="shift-card-officer">
                              {shift.officer ? `${shift.officer.firstName} ${shift.officer.lastName}` : "Unassigned"}
                            </div>
                          </div>
                          <ShiftStatusBadge status={shift.status} />
                        </div>
                        <div className="shift-card-time">
                          {formatTime(shift.startTime)} – {formatTime(shift.endTime)}
                        </div>
                        <div className="shift-card-footer">
                          <select
                            value={shift.status}
                            onChange={(e) => handleStatusChange(shift, e.target.value as ShiftStatus)}
                            style={{ fontSize: 12, padding: "4px 6px" }}
                          >
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                          <button
                            className="btn btn-secondary"
                            onClick={() => handleDelete(shift)}
                            aria-label="Delete shift"
                          >
                            <TrashIcon width={14} height={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
