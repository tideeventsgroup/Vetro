import { FormEvent, useEffect, useState } from "react";
import { PlusIcon, TrashIcon } from "../components/icons.js";
import { Officer, Shift, ShiftStatus, Site, useApi } from "../lib/api.js";

const STATUS_OPTIONS: ShiftStatus[] = ["SCHEDULED", "CONFIRMED", "COMPLETED", "MISSED", "LATE"];

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function Schedule() {
  const api = useApi();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [siteFilter, setSiteFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [showAddShift, setShowAddShift] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    void loadReference();
  }, []);

  useEffect(() => {
    void loadShifts();
  }, [siteFilter]);

  async function loadReference() {
    const [siteRows, officerRows] = await Promise.all([api.listSites(), api.listOfficers()]);
    setSites(siteRows);
    setOfficers(officerRows);
  }

  async function loadShifts() {
    setIsLoading(true);
    try {
      setShifts(await api.listShifts(siteFilter ? { siteId: siteFilter } : undefined));
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

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Schedule</h1>
          <p>Who's working where.</p>
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
          <div className="form-field" style={{ maxWidth: 280 }}>
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
          ) : shifts.length === 0 ? (
            <div className="card empty-state">
              <p>No shifts scheduled yet.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Site</th>
                  <th>Officer</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((shift) => (
                  <tr key={shift.id}>
                    <td>{shift.site?.name ?? "—"}</td>
                    <td>{shift.officer ? `${shift.officer.firstName} ${shift.officer.lastName}` : "Unassigned"}</td>
                    <td>{formatDateTime(shift.startTime)}</td>
                    <td>{formatDateTime(shift.endTime)}</td>
                    <td>
                      <select
                        value={shift.status}
                        onChange={(e) => handleStatusChange(shift, e.target.value as ShiftStatus)}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button className="btn btn-secondary" onClick={() => handleDelete(shift)}>
                        <TrashIcon width={14} height={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
