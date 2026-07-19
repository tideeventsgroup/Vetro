import { useEffect, useState } from "react";
import { BarChartIcon } from "../components/icons.js";
import { ShiftMixBar, ShiftMixLegend } from "../components/ShiftMixBar.js";
import { SiteReport, useApi } from "../lib/api.js";

export function Reports() {
  const api = useApi();
  const [rows, setRows] = useState<SiteReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    api
      .listSiteReports()
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load reports"))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Reports</h1>
          <p>Shift coverage and officer compliance, per site.</p>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {isLoading ? (
        <p style={{ color: "var(--vetro-text-muted)" }}>Loading…</p>
      ) : rows.length === 0 ? (
        <div className="card empty-state">
          <span className="empty-icon">
            <BarChartIcon />
          </span>
          <p>Add sites and shifts to see reporting here.</p>
        </div>
      ) : (
        <>
          <ShiftMixLegend />
          <table className="data-table">
            <thead>
              <tr>
                <th>Site</th>
                <th>Officers</th>
                <th>At risk</th>
                <th>Shift mix</th>
                <th>Scheduled</th>
                <th>Confirmed</th>
                <th>Completed</th>
                <th>Missed</th>
                <th>Late</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.officerCount}</td>
                  <td>
                    {row.officersAtRisk > 0 ? (
                      <span style={{ color: "var(--vetro-status-red-text)", fontWeight: 600 }}>{row.officersAtRisk}</span>
                    ) : (
                      "0"
                    )}
                  </td>
                  <td style={{ minWidth: 140 }}>
                    <ShiftMixBar counts={row.shiftCounts} />
                  </td>
                  <td>{row.shiftCounts.SCHEDULED}</td>
                  <td>{row.shiftCounts.CONFIRMED}</td>
                  <td>{row.shiftCounts.COMPLETED}</td>
                  <td>{row.shiftCounts.MISSED}</td>
                  <td>{row.shiftCounts.LATE}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
