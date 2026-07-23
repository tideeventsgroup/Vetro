import { useEffect, useState } from "react";
import { GapFinding } from "../lib/api.js";

// Shows the deterministic BS7858/BPSS gap-check (backend/src/lib/
// vettingCompliance.ts) plus an on-demand AI second-opinion (Groq — see
// backend/src/lib/groq.ts) on top of it. Used both pre-conversion (a
// candidate's invite, in Vetting.tsx) and post-conversion (an officer
// already on the roster, in OfficerDetail.tsx) — the caller supplies which
// endpoints to hit, the panel itself doesn't know which.
export function ComplianceGapPanel({
  loadGaps,
  loadAiReview,
}: {
  loadGaps: () => Promise<GapFinding[]>;
  loadAiReview: () => Promise<string>;
}) {
  const [findings, setFindings] = useState<GapFinding[] | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [aiReview, setAiReview] = useState<string | undefined>(undefined);
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewError, setReviewError] = useState<string | undefined>(undefined);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setIsLoading(true);
    setError(undefined);
    try {
      setFindings(await loadGaps());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not run compliance check");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAiReview() {
    setReviewError(undefined);
    setIsReviewing(true);
    try {
      setAiReview(await loadAiReview());
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "Could not run AI review");
    } finally {
      setIsReviewing(false);
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2>BS7858 / BPSS compliance check</h2>
      </div>

      {isLoading ? (
        <p className="subtle-meta">Checking…</p>
      ) : error ? (
        <p className="error-text">{error}</p>
      ) : findings && findings.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--vetro-status-green-text)" }}>
          No gaps found — address/employment history, references, DBS, right to work, and identity document all
          check out against BS7858 and BPSS.
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 12px" }}>
          {findings?.map((f, i) => (
            <li key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "6px 0", fontSize: 13 }}>
              <span
                className={`status-badge ${f.severity === "critical" ? "status-expired" : "status-expiring"}`}
                style={{ flexShrink: 0 }}
              >
                {f.standard}
              </span>
              <span>{f.message}</span>
            </li>
          ))}
        </ul>
      )}

      <button className="btn btn-secondary" onClick={handleAiReview} disabled={isReviewing}>
        {isReviewing ? "Running AI review…" : "Run AI review"}
      </button>
      {reviewError && <p className="error-text">{reviewError}</p>}
      {aiReview && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            background: "var(--vetro-bg)",
            border: "1px solid var(--vetro-border)",
            borderRadius: 6,
            fontSize: 13,
            whiteSpace: "pre-wrap",
          }}
        >
          {aiReview}
        </div>
      )}
    </div>
  );
}
