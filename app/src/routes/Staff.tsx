import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PinBadge, VettingBadge, formatCompactDate } from "../components/OfficerBadges.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { ArrowLeftIcon, ShieldCheckIcon } from "../components/icons.js";
import {
  ComplianceStatus,
  EmploymentType,
  Officer,
  PayRateType,
  VettingSubmissionForReview,
  useApi,
} from "../lib/api.js";
import { useTenantSlug } from "../lib/tenant.js";
import { worstDbsCheck, worstStatus } from "../lib/status.js";

const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CASUAL: "Casual",
  ZERO_HOURS: "Zero-hours",
};

const PAY_RATE_TYPE_LABELS: Record<PayRateType, string> = {
  HOURLY: "per hour",
  DAILY: "per day",
  SALARY: "per year",
};

const STATUS_DOT_COLOR: Record<ComplianceStatus, string> = {
  ACTIVE: "var(--vetro-status-green-text)",
  EXPIRING: "var(--vetro-status-amber-text)",
  EXPIRED: "var(--vetro-status-red-text)",
};

function initials(officer: Officer): string {
  return `${officer.firstName[0] ?? ""}${officer.lastName[0] ?? ""}`.toUpperCase();
}

function formatPayRate(officer: Officer): string {
  if (officer.payRate == null) return "—";
  const basis = officer.payRateType ? PAY_RATE_TYPE_LABELS[officer.payRateType] : "";
  return `£${officer.payRate.toFixed(2)}${basis ? ` ${basis}` : ""}`;
}

// A read-focused browse view over the roster — search/select an officer to
// see their compliance snapshot at a glance. Full editing (HR profile,
// licences, vetting records, documents, invites) stays on OfficerDetail.tsx;
// this page links through to it rather than duplicating those forms.
export function Staff() {
  const api = useApi();
  const tenant = useTenantSlug();
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [pendingByOfficer, setPendingByOfficer] = useState<Map<string, VettingSubmissionForReview>>(new Map());
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isReviewing, setIsReviewing] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setIsLoading(true);
    try {
      const [officerRows, pending] = await Promise.all([
        api.listOfficers(),
        api.listVettingSubmissionsForReview("PENDING_REVIEW"),
      ]);
      setOfficers(officerRows);
      setPendingByOfficer(new Map(pending.map((p) => [p.officer.id, p])));
      setSelectedId((current) => current ?? officerRows[0]?.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load staff directory");
    } finally {
      setIsLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return officers;
    return officers.filter((o) => `${o.firstName} ${o.lastName} ${o.jobTitle ?? ""}`.toLowerCase().includes(q));
  }, [officers, search]);

  const selected = officers.find((o) => o.id === selectedId);
  const pendingSubmission = selected ? pendingByOfficer.get(selected.id) : undefined;
  const selectedDbs = selected ? worstDbsCheck(selected.dbsChecks) : undefined;

  async function handleReview(status: "APPROVED" | "REJECTED") {
    if (!pendingSubmission) return;
    setIsReviewing(true);
    setError(undefined);
    try {
      await api.reviewVettingSubmission(pendingSubmission.id, { status });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save review");
    } finally {
      setIsReviewing(false);
    }
  }

  if (isLoading) return <p style={{ color: "var(--vetro-text-muted)" }}>Loading…</p>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Staff Directory</h1>
          <p>Every officer's contract, licence, and vetting record in one place.</p>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {officers.length === 0 ? (
        <div className="card empty-state">
          <span className="empty-icon">
            <ShieldCheckIcon />
          </span>
          <p>No officers added yet.</p>
        </div>
      ) : (
        <div className="staff-layout">
          <div className="card" style={{ padding: 10 }}>
            <div className="form-field" style={{ margin: "0 4px 8px" }}>
              <input
                placeholder="Search staff…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search staff"
              />
            </div>
            <div className="staff-list">
              {filtered.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className={`staff-list-item${o.id === selectedId ? " active" : ""}`}
                  onClick={() => setSelectedId(o.id)}
                >
                  <span className="staff-list-item-name">
                    <span
                      className="staff-status-dot"
                      style={{ background: STATUS_DOT_COLOR[worstStatus(o)] }}
                    />
                    {o.firstName} {o.lastName}
                  </span>
                  <span className="staff-list-item-meta">{o.jobTitle || "Security officer"}</span>
                </button>
              ))}
            </div>
          </div>

          {selected && (
            <div className="card">
              <div className="card-header">
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span className="officer-avatar" style={{ width: 40, height: 40, fontSize: 15 }}>
                    {initials(selected)}
                  </span>
                  <div>
                    <h2 style={{ marginBottom: 2 }}>
                      {selected.firstName} {selected.lastName}
                    </h2>
                    <p style={{ margin: 0, color: "var(--vetro-text-muted)", fontSize: 13 }}>
                      {selected.jobTitle || "Security officer"}
                    </p>
                  </div>
                </div>
                <Link to={`/${tenant}/officers/${selected.id}`} className="btn btn-secondary">
                  <ArrowLeftIcon width={14} height={14} style={{ transform: "rotate(180deg)" }} />
                  View full profile
                </Link>
              </div>

              <div style={{ display: "flex", gap: 8, margin: "4px 0 16px" }}>
                <VettingBadge officer={selected} />
                <PinBadge officer={selected} />
              </div>

              {pendingSubmission && (
                <div
                  className="card"
                  style={{ background: "var(--vetro-badge-blue-bg)", borderColor: "var(--vetro-badge-blue-text)", marginBottom: 16 }}
                >
                  <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--vetro-badge-blue-text)" }}>
                    Vetting submitted to provider — awaiting a result.
                  </p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="btn"
                      disabled={isReviewing}
                      style={{ background: "var(--vetro-badge-green-bg)", color: "var(--vetro-status-green-text)" }}
                      onClick={() => handleReview("APPROVED")}
                    >
                      Mark cleared
                    </button>
                    <button
                      className="btn"
                      disabled={isReviewing}
                      style={{ background: "var(--vetro-badge-red-bg)", color: "var(--vetro-status-red-text)" }}
                      onClick={() => handleReview("REJECTED")}
                    >
                      Mark failed
                    </button>
                  </div>
                </div>
              )}

              <div className="detail-field-label">Contract</div>
              <div className="detail-field-grid">
                <div>
                  <div className="detail-field-label">Employment</div>
                  <div className="detail-field-value">
                    {selected.employmentType ? EMPLOYMENT_TYPE_LABELS[selected.employmentType] : "—"}
                  </div>
                </div>
                <div>
                  <div className="detail-field-label">Start date</div>
                  <div className="detail-field-value">
                    {selected.startDate ? formatCompactDate(selected.startDate) : "—"}
                  </div>
                </div>
                <div>
                  <div className="detail-field-label">Pay rate</div>
                  <div className="detail-field-value">{formatPayRate(selected)}</div>
                </div>
              </div>

              <div className="detail-field-label">Compliance</div>
              <div className="detail-field-grid">
                <div>
                  <div className="detail-field-label">SIA licence no.</div>
                  <div className="detail-field-value">{selected.licences[0]?.licenceNumber ?? "—"}</div>
                </div>
                <div>
                  <div className="detail-field-label">BS7858 vetting expiry</div>
                  <div className="detail-field-value">
                    {selected.vettingRecords[0]?.expiryDate ? formatCompactDate(selected.vettingRecords[0].expiryDate) : "—"}
                  </div>
                </div>
                <div>
                  <div className="detail-field-label">Right to work</div>
                  <div className="detail-field-value">
                    <span className={`status-badge ${selected.rightToWorkConfirmed ? "status-active" : "status-expiring"}`}>
                      {selected.rightToWorkConfirmed ? "Verified" : "Pending"}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="detail-field-label">DBS check</div>
                  <div className="detail-field-value">
                    {selectedDbs ? <StatusBadge status={selectedDbs.status} /> : "—"}
                  </div>
                </div>
              </div>

              <div className="detail-field-label">Emergency contact</div>
              <div className="detail-field-grid" style={{ marginBottom: 0 }}>
                <div>
                  <div className="detail-field-label">Name</div>
                  <div className="detail-field-value">{selected.emergencyContactName ?? "—"}</div>
                </div>
                <div>
                  <div className="detail-field-label">Phone</div>
                  <div className="detail-field-value">{selected.emergencyContactPhone ?? "—"}</div>
                </div>
                <div>
                  <div className="detail-field-label">Relationship</div>
                  <div className="detail-field-value">{selected.emergencyContactRelationship ?? "—"}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
