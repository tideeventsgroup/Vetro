import { ShiftStatus } from "../lib/api.js";

const ORDER: ShiftStatus[] = ["SCHEDULED", "CONFIRMED", "COMPLETED", "MISSED", "LATE"];

const LABELS: Record<ShiftStatus, string> = {
  SCHEDULED: "Scheduled",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  MISSED: "Missed",
  LATE: "Late",
};

// Fixed order, never reassigned by which statuses happen to be present —
// identity comes from position + the shared legend below, not from color
// alone (see StatusBadge.tsx for the same five colours used as pill badges
// elsewhere; this is the bar-segment form of the same status palette).
const COLORS: Record<ShiftStatus, string> = {
  SCHEDULED: "var(--vetro-ink-300)",
  CONFIRMED: "var(--vetro-teal)",
  COMPLETED: "var(--vetro-status-green)",
  MISSED: "var(--vetro-status-red)",
  LATE: "var(--vetro-status-amber)",
};

export function ShiftMixLegend() {
  return (
    <div className="shift-mix-legend">
      {ORDER.map((status) => (
        <span key={status} className="shift-mix-legend-item">
          <span className="shift-mix-swatch" style={{ background: COLORS[status] }} />
          {LABELS[status]}
        </span>
      ))}
    </div>
  );
}

export function ShiftMixBar({ counts }: { counts: Record<ShiftStatus, number> }) {
  const total = ORDER.reduce((sum, status) => sum + (counts[status] ?? 0), 0);

  if (total === 0) {
    return <div className="shift-mix-bar shift-mix-bar-empty" title="No shifts yet" />;
  }

  return (
    <div className="shift-mix-bar" role="img" aria-label={ORDER.map((s) => `${LABELS[s]} ${counts[s] ?? 0}`).join(", ")}>
      {ORDER.filter((status) => (counts[status] ?? 0) > 0).map((status) => (
        <div
          key={status}
          className="shift-mix-segment"
          style={{ background: COLORS[status], flexGrow: counts[status] }}
          title={`${LABELS[status]}: ${counts[status]}`}
        />
      ))}
    </div>
  );
}
