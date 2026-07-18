import { Fragment, useEffect, useState } from "react";
import { FileIcon, ShieldCheckIcon } from "../components/icons.js";
import { Incident, IncidentCategory, Site, useApi } from "../lib/api.js";

const CATEGORY_LABELS: Record<IncidentCategory, string> = {
  THEFT: "Theft",
  VANDALISM: "Vandalism",
  TRESPASSING: "Trespassing",
  MEDICAL: "Medical",
  FIRE_SAFETY: "Fire / safety",
  EQUIPMENT_FAULT: "Equipment fault",
  SUSPICIOUS_ACTIVITY: "Suspicious activity",
  OTHER: "Other",
};

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Read-only admin view of what officers file from the self-service portal
// (routes/MyIncidents.tsx) — extra evidence for an ACS inspection alongside
// the compliance record, and the first place to look when a client asks
// "what happened at my site last week."
export function Incidents() {
  const api = useApi();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [siteFilter, setSiteFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | undefined>(undefined);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    void api.listSites().then(setSites);
  }, []);

  useEffect(() => {
    void load();
  }, [siteFilter]);

  async function load() {
    setIsLoading(true);
    try {
      setIncidents(await api.listIncidents({ siteId: siteFilter || undefined }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load incidents");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleViewPhoto(incidentId: string, key: string) {
    if (photoUrls[key]) {
      window.open(photoUrls[key], "_blank");
      return;
    }
    const url = await api.getIncidentPhotoUrl(incidentId, key);
    setPhotoUrls((current) => ({ ...current, [key]: url }));
    window.open(url, "_blank");
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Incidents</h1>
          <p>What officers have filed on-site — extra evidence for an ACS inspection.</p>
        </div>
      </div>

      <div className="form-field" style={{ maxWidth: 240 }}>
        <label htmlFor="incidentSiteFilter">Site</label>
        <select id="incidentSiteFilter" value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}>
          <option value="">All sites</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="error-text">{error}</p>}

      {isLoading ? (
        <p style={{ color: "var(--vetro-text-muted)" }}>Loading…</p>
      ) : incidents.length === 0 ? (
        <div className="card empty-state">
          <span className="empty-icon">
            <ShieldCheckIcon />
          </span>
          <p>No incidents reported.</p>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Site</th>
              <th>Category</th>
              <th>Officer</th>
              <th>Occurred</th>
            </tr>
          </thead>
          <tbody>
            {incidents.map((incident) => (
              <Fragment key={incident.id}>
                <tr className="clickable" onClick={() => setExpandedId((v) => (v === incident.id ? undefined : incident.id))}>
                  <td>{incident.site?.name ?? "—"}</td>
                  <td>{CATEGORY_LABELS[incident.category]}</td>
                  <td>
                    {incident.officer ? `${incident.officer.firstName} ${incident.officer.lastName}` : "—"}
                  </td>
                  <td>{formatDateTime(incident.occurredAt)}</td>
                </tr>
                {expandedId === incident.id && (
                  <tr>
                    <td colSpan={4} style={{ background: "var(--vetro-bg)" }}>
                      <div style={{ padding: "12px 4px" }}>
                        <p style={{ fontSize: 14, color: "var(--vetro-text-secondary)", marginBottom: incident.photoKeys.length ? 12 : 0 }}>
                          {incident.description}
                        </p>
                        {incident.photoKeys.length > 0 && (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {incident.photoKeys.map((key) => (
                              <button
                                key={key}
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => handleViewPhoto(incident.id, key)}
                              >
                                <FileIcon width={14} height={14} />
                                Photo
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
