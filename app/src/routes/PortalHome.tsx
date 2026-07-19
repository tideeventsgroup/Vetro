import { ReactNode, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DocumentsSection } from "../components/DocumentsSection.js";
import { ShiftStatusBadge, StatusBadge, SubmissionStatusBadge } from "../components/StatusBadge.js";
import {
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  LockIcon,
  MapPinIcon,
  MessageIcon,
  RouteIcon,
  ShieldCheckIcon,
  UsersIcon,
  WarningIcon,
} from "../components/icons.js";
import { Officer, Shift, useApi } from "../lib/api.js";
import { useTenantSlug } from "../lib/tenant.js";
import { worstStatus } from "../lib/status.js";
import { getGpsPosition } from "../lib/geo.js";
import { LOCKED_SEGMENTS } from "./PortalLayout.js";

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
}

function formatDay(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

const QUICK_ACTIONS: Array<{ segment: string; label: string; icon: ReactNode }> = [
  { segment: "shifts", label: "My shifts", icon: <CalendarIcon /> },
  { segment: "incidents", label: "Incidents", icon: <WarningIcon /> },
  { segment: "patrols", label: "Patrols", icon: <RouteIcon /> },
  { segment: "visitor-log", label: "Visitor log", icon: <UsersIcon /> },
];

// The officer's landing screen — what they open the app for day to day: is
// there a shift to confirm/clock into right now, and the handful of things
// they might need next. Their compliance record (licences, vetting
// submissions, documents) still lives here too, further down — it's the
// same "own record" data as before, just no longer the first thing shown.
export function PortalHome() {
  const api = useApi();
  const tenant = useTenantSlug();
  const [officer, setOfficer] = useState<Officer | undefined>(undefined);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [busyShiftId, setBusyShiftId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  const latestSubmission = useMemo(() => {
    const submissions = officer?.vettingSubmissions ?? [];
    if (submissions.length === 0) return undefined;
    return [...submissions].sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    )[0];
  }, [officer]);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const [officerRow, shiftRows, unread] = await Promise.all([
      api.getMyOfficer(),
      api.listMyShifts(),
      api.getMyUnreadMessageCount(),
    ]);
    setOfficer(officerRow);
    setShifts(shiftRows);
    setUnreadCount(unread.unreadCount);
  }

  const vettingCompleted = (officer?.vettingRecords.length ?? 0) > 0;

  const activeShift = useMemo(() => shifts.find((s) => s.clockInAt && !s.clockOutAt), [shifts]);
  const nextShift = useMemo(() => {
    if (activeShift) return activeShift;
    const now = Date.now();
    // COMPLETED/MISSED/LATE are all terminal, client-confirmed outcomes for
    // a shift that's already over (see routes/client.ts) — none of them
    // belong in "what's next".
    return shifts
      .filter(
        (s) =>
          s.status !== "COMPLETED" &&
          s.status !== "MISSED" &&
          s.status !== "LATE" &&
          new Date(s.endTime).getTime() >= now
      )
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0];
  }, [shifts, activeShift]);

  async function handleConfirm(shift: Shift) {
    setBusyShiftId(shift.id);
    setError(undefined);
    try {
      await api.confirmMyShift(shift.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm this shift");
    } finally {
      setBusyShiftId(undefined);
    }
  }

  async function handleClockIn(shift: Shift) {
    setBusyShiftId(shift.id);
    setError(undefined);
    try {
      const gps = await getGpsPosition();
      await api.clockInMyShift(shift.id, gps);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not clock in");
    } finally {
      setBusyShiftId(undefined);
    }
  }

  async function handleClockOut(shift: Shift) {
    setBusyShiftId(shift.id);
    setError(undefined);
    try {
      const gps = await getGpsPosition();
      await api.clockOutMyShift(shift.id, gps);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not clock out");
    } finally {
      setBusyShiftId(undefined);
    }
  }

  if (!officer) return <p style={{ color: "var(--vetro-text-muted)" }}>Loading…</p>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Welcome back, {officer.firstName}</h1>
          <p>{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</p>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {!vettingCompleted &&
        (!latestSubmission ? (
          <div className="welcome-banner">
            <span className="welcome-banner-icon">
              <ShieldCheckIcon />
            </span>
            <div className="welcome-banner-text">
              <h3>Welcome, {officer.firstName}!</h3>
              <p>
                You're not onboarded yet — complete your vetting now to unlock shifts, incidents, patrols,
                and the visitor log.
              </p>
            </div>
            <div className="welcome-banner-actions">
              <Link to={`/${tenant}/portal/vetting`} className="btn btn-primary">
                Complete vetting now
              </Link>
            </div>
          </div>
        ) : (
          <div className="welcome-banner">
            <span className="welcome-banner-icon">
              <ShieldCheckIcon />
            </span>
            <div className="welcome-banner-text">
              <h3>Vetting submitted</h3>
              <p>
                Your admin is reviewing what you submitted — shifts, incidents, patrols, and the visitor
                log unlock once it's approved.
              </p>
            </div>
          </div>
        ))}

      {vettingCompleted && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <h2>{activeShift ? "Currently working" : "Next shift"}</h2>
            <Link to={`/${tenant}/portal/shifts`} className="btn btn-secondary">
              View all shifts
            </Link>
          </div>
          {!nextShift ? (
            <p style={{ color: "var(--vetro-text-muted)", fontSize: 14, margin: 0 }}>
              Nothing scheduled — check back once your next shift is rostered.
            </p>
          ) : (
            <div className="shift-card" style={{ boxShadow: "none", border: "1px solid var(--vetro-border)" }}>
              <div className="shift-card-header">
                <div>
                  <div className="shift-card-site">{nextShift.site?.name ?? "—"}</div>
                  {nextShift.site?.address && (
                    <div className="shift-card-officer">
                      <MapPinIcon width={12} height={12} /> {nextShift.site.address}
                    </div>
                  )}
                </div>
                <ShiftStatusBadge status={nextShift.status} />
              </div>
              <div className="shift-card-time">
                {formatDay(nextShift.startTime)} · {formatTime(nextShift.startTime)} – {formatTime(nextShift.endTime)}
              </div>
              {nextShift.clockInAt && (
                <p className="subtle-meta" style={{ margin: 0 }}>
                  <ClockIcon width={12} height={12} />
                  {nextShift.clockOutAt
                    ? `Worked ${formatTime(nextShift.clockInAt)} – ${formatTime(nextShift.clockOutAt)}`
                    : `Clocked in at ${formatTime(nextShift.clockInAt)}`}
                  {nextShift.clockInDistanceM !== null && " · GPS verified on site"}
                </p>
              )}
              {nextShift.status === "SCHEDULED" && (
                <div className="shift-card-footer">
                  <button
                    className="btn btn-primary"
                    onClick={() => handleConfirm(nextShift)}
                    disabled={busyShiftId === nextShift.id}
                    style={{ width: "100%" }}
                  >
                    <CheckIcon width={14} height={14} />
                    {busyShiftId === nextShift.id ? "Confirming…" : "Confirm shift"}
                  </button>
                </div>
              )}
              {nextShift.status === "CONFIRMED" && !nextShift.clockInAt && (
                <div className="shift-card-footer">
                  <button
                    className="btn btn-primary"
                    onClick={() => handleClockIn(nextShift)}
                    disabled={busyShiftId === nextShift.id}
                    style={{ width: "100%" }}
                  >
                    <ClockIcon width={14} height={14} />
                    {busyShiftId === nextShift.id ? "Clocking in…" : "Clock in"}
                  </button>
                </div>
              )}
              {nextShift.clockInAt && !nextShift.clockOutAt && (
                <div className="shift-card-footer">
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleClockOut(nextShift)}
                    disabled={busyShiftId === nextShift.id}
                    style={{ width: "100%" }}
                  >
                    {busyShiftId === nextShift.id ? "Clocking out…" : "Clock out"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="quick-actions-grid">
        {QUICK_ACTIONS.map((action) => {
          const locked = !vettingCompleted && LOCKED_SEGMENTS.includes(action.segment);
          return locked ? (
            <span key={action.segment} className="quick-action-tile quick-action-tile-locked" aria-disabled="true">
              <span className="quick-action-tile-icon">{action.icon}</span>
              {action.label}
              <LockIcon width={13} height={13} />
            </span>
          ) : (
            <Link key={action.segment} to={`/${tenant}/portal/${action.segment}`} className="quick-action-tile">
              <span className="quick-action-tile-icon">{action.icon}</span>
              {action.label}
            </Link>
          );
        })}
        <Link to={`/${tenant}/portal/messages`} className="quick-action-tile">
          {unreadCount > 0 && <span className="nav-badge quick-action-tile-badge">{unreadCount}</span>}
          <span className="quick-action-tile-icon">
            <MessageIcon />
          </span>
          Messages
        </Link>
        <Link to={`/${tenant}/portal/vetting`} className="quick-action-tile">
          <span className="quick-action-tile-icon">
            <ShieldCheckIcon />
          </span>
          Vetting
        </Link>
      </div>

      <div className="summary-grid">
        <div className="summary-tile">
          <div>
            <div className="label" style={{ marginBottom: 6 }}>
              Overall status
            </div>
            <StatusBadge status={worstStatus(officer)} />
          </div>
        </div>
        <div className="summary-tile">
          <div>
            <div className="count">{officer.licences.length}</div>
            <div className="label">Licences on file</div>
          </div>
        </div>
        <div className="summary-tile">
          <div>
            <div className="label" style={{ marginBottom: 6 }}>
              Latest vetting submission
            </div>
            {latestSubmission ? (
              <SubmissionStatusBadge status={latestSubmission.status} />
            ) : (
              <span className="subtle-meta" style={{ margin: 0 }}>
                Not submitted yet
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>SIA licences</h2>
        </div>
        {officer.licences.length === 0 ? (
          <p style={{ color: "var(--vetro-text-muted)", fontSize: 14 }}>No licences on file.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Sector</th>
                <th>Reference</th>
                <th>Status</th>
                <th>Expires</th>
              </tr>
            </thead>
            <tbody>
              {officer.licences.map((l) => (
                <tr key={l.id}>
                  <td>{l.sector}</td>
                  <td>{l.licenceNumber}</td>
                  <td>
                    <StatusBadge status={l.status} />
                  </td>
                  <td>{formatDate(l.expiryDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Vetting submissions</h2>
          <Link to={`/${tenant}/portal/vetting`} className="btn btn-secondary">
            <ShieldCheckIcon width={14} height={14} />
            {latestSubmission ? "Submit an update" : "Submit vetting details"}
          </Link>
        </div>
        <p style={{ color: "var(--vetro-text-muted)", fontSize: 14, marginBottom: 12 }}>
          Vetro tracks your BS7858 status — it doesn't carry out the check itself. Your admin reviews what
          you submit.
        </p>
        {(officer.vettingSubmissions ?? []).length === 0 ? (
          <p style={{ color: "var(--vetro-text-muted)", fontSize: 14 }}>No submissions yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Submitted</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {(officer.vettingSubmissions ?? []).map((s) => (
                <tr key={s.id}>
                  <td>{formatDate(s.submittedAt)}</td>
                  <td>
                    <SubmissionStatusBadge status={s.status} />
                  </td>
                  <td>{s.reviewNotes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <DocumentsSection
        documents={officer.documents ?? []}
        onUpload={(file, kind) => api.uploadMyDocument(file, kind)}
        onGetDownloadUrl={(id) => api.getMyDocumentDownloadUrl(id)}
        onChange={load}
      />
    </div>
  );
}
