import { ChangeEvent, useEffect, useState } from "react";
import { FileIcon, MapPinIcon, PlusIcon, TrashIcon, UploadIcon } from "../components/icons.js";
import { Incident, IncidentCategory, Site, useApi } from "../lib/api.js";
import { getGpsPosition } from "../lib/geo.js";

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

const CATEGORIES = Object.keys(CATEGORY_LABELS) as IncidentCategory[];

function toLocalDateTimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Filed by whichever officer was on-site — the one feature every guard
// management product treats as core, and doubles as extra evidence for an
// ACS inspection alongside the compliance record.
export function MyIncidents() {
  const api = useApi();
  const [sites, setSites] = useState<Site[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [siteId, setSiteId] = useState("");
  const [category, setCategory] = useState<IncidentCategory>("OTHER");
  const [occurredAt, setOccurredAt] = useState(toLocalDateTimeInput(new Date()));
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const [siteRows, incidentRows] = await Promise.all([api.listMySites(), api.listMyIncidents()]);
    setSites(siteRows);
    setIncidents(incidentRows);
    if (siteRows.length > 0) setSiteId((current) => current || siteRows[0].id);
  }

  function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    setPhotos((current) => [...current, ...files]);
  }

  async function handleSubmit() {
    setError(undefined);
    if (!siteId || !description.trim()) {
      setError("Site and description are required.");
      return;
    }
    setIsSubmitting(true);
    try {
      const photoKeys = [];
      for (const file of photos) {
        photoKeys.push(await api.uploadMyIncidentPhoto(file));
      }
      const gps = await getGpsPosition();
      await api.reportIncident({
        siteId,
        category,
        description: description.trim(),
        occurredAt: new Date(occurredAt).toISOString(),
        photoKeys,
        ...gps,
      });
      setDescription("");
      setPhotos([]);
      setCategory("OTHER");
      setOccurredAt(toLocalDateTimeInput(new Date()));
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not file this incident");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleViewPhoto(incidentId: string, key: string) {
    if (photoUrls[key]) {
      window.open(photoUrls[key], "_blank");
      return;
    }
    const url = await api.getMyIncidentPhotoUrl(incidentId, key);
    setPhotoUrls((current) => ({ ...current, [key]: url }));
    window.open(url, "_blank");
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Incidents</h1>
          <p>File what happened, and see what you've reported.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)} disabled={sites.length === 0}>
            {!showForm && <PlusIcon width={14} height={14} />}
            {showForm ? "Cancel" : "Report incident"}
          </button>
        </div>
      </div>

      {sites.length === 0 && (
        <div className="card empty-state">
          <p>You need a shift at a site before you can file an incident there.</p>
        </div>
      )}

      {showForm && (
        <div className="card">
          {error && <p className="error-text">{error}</p>}
          <div className="form-field">
            <label htmlFor="incidentSite">Site</label>
            <select id="incidentSite" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="incidentCategory">Category</label>
            <select
              id="incidentCategory"
              value={category}
              onChange={(e) => setCategory(e.target.value as IncidentCategory)}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="incidentOccurredAt">When did it happen?</label>
            <input
              id="incidentOccurredAt"
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="incidentDescription">What happened</label>
            <textarea
              id="incidentDescription"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <label className="btn btn-secondary" style={{ display: "inline-flex", marginBottom: 12, cursor: "pointer" }}>
            <UploadIcon width={14} height={14} />
            Add photo
            <input type="file" accept="image/*" multiple onChange={handlePhotoChange} style={{ display: "none" }} />
          </label>

          {photos.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              {photos.map((file, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: 13,
                    padding: "6px 0",
                  }}
                >
                  <span>{file.name}</span>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setPhotos((current) => current.filter((_, idx) => idx !== i))}
                  >
                    <TrashIcon width={14} height={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button className="btn btn-primary" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Submitting…" : "Submit incident"}
          </button>
        </div>
      )}

      {incidents.length === 0 ? (
        <div className="card empty-state">
          <p>No incidents reported yet.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {incidents.map((incident) => (
            <div className="card" key={incident.id}>
              <div className="card-header">
                <h2 style={{ fontSize: 15 }}>
                  {CATEGORY_LABELS[incident.category]} — {incident.site?.name ?? "—"}
                </h2>
                <span className="subtle-meta" style={{ margin: 0 }}>
                  {formatDateTime(incident.occurredAt)}
                </span>
              </div>
              <p style={{ fontSize: 14, color: "var(--vetro-text-secondary)", marginBottom: 8 }}>
                {incident.description}
              </p>
              {incident.latitude !== null && (
                <p style={{ fontSize: 12, color: "var(--vetro-text-muted)", margin: "0 0 8px" }}>
                  <MapPinIcon width={11} height={11} /> GPS logged
                </p>
              )}
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
          ))}
        </div>
      )}
    </div>
  );
}
