import { Fragment, FormEvent, useEffect, useState } from "react";
import QRCode from "qrcode";
import { MapPinIcon, PlusIcon, TrashIcon } from "../components/icons.js";
import { Checkpoint, CheckpointScan, Site, useApi } from "../lib/api.js";
import { useCurrentLocation } from "../lib/geo.js";
import { formatDateTime } from "../lib/format.js";

function QrCodeCell({ checkpoint }: { checkpoint: Checkpoint }) {
  const [dataUrl, setDataUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    void QRCode.toDataURL(checkpoint.qrCode, { width: 96, margin: 1 }).then(setDataUrl);
  }, [checkpoint.qrCode]);

  function handlePrint() {
    const win = window.open("", "_blank", "width=400,height=500");
    if (!win || !dataUrl) return;
    win.document.write(`
      <html>
        <head><title>${checkpoint.name} — checkpoint QR</title></head>
        <body style="text-align:center;font-family:sans-serif;padding:32px;">
          <h2>${checkpoint.name}</h2>
          <img src="${dataUrl}" width="240" height="240" style="image-rendering:pixelated;" />
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);
    win.document.close();
  }

  if (!dataUrl) return null;
  return (
    <button
      type="button"
      onClick={handlePrint}
      style={{ border: "none", background: "none", cursor: "pointer", padding: 0 }}
      title="Click to print"
    >
      <img src={dataUrl} width={40} height={40} alt={`QR code for ${checkpoint.name}`} />
    </button>
  );
}

// Admin side of the patrol tour: define checkpoints per site, then see
// whether the round actually got walked. Officers scan from the
// self-service portal (routes/MyPatrols.tsx) — either the manual button or
// by scanning the printed QR code this page generates for each checkpoint.
export function Patrols() {
  const api = useApi();
  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState("");
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [scans, setScans] = useState<CheckpointScan[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [expandedId, setExpandedId] = useState<string | undefined>(undefined);
  const [geofenceStatus, setGeofenceStatus] = useState<string | undefined>(undefined);
  const geoLocation = useCurrentLocation("cpEditLat", "cpEditLng");

  useEffect(() => {
    void loadSites();
  }, []);

  useEffect(() => {
    void loadCheckpoints();
    void loadLog();
  }, [siteId]);

  async function loadSites() {
    const rows = await api.listSites();
    setSites(rows);
    if (rows.length > 0) setSiteId(rows[0].id);
  }

  async function loadCheckpoints() {
    if (!siteId) return;
    setCheckpoints(await api.listCheckpoints(siteId));
  }

  async function loadLog() {
    setScans(await api.listPatrolLog({ siteId: siteId || undefined }));
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    setError(undefined);
    try {
      await api.createCheckpoint({ siteId, name: name.trim(), description: description.trim() || undefined });
      setName("");
      setDescription("");
      setShowAddForm(false);
      await loadCheckpoints();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add checkpoint");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Remove this checkpoint?")) return;
    await api.deleteCheckpoint(id);
    await loadCheckpoints();
  }

  function toggleExpand(id: string) {
    setExpandedId((current) => (current === id ? undefined : id));
    setGeofenceStatus(undefined);
  }

  async function handleSaveGeofence(e: FormEvent<HTMLFormElement>, checkpointId: string) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const lat = String(form.get("latitude") || "");
    const lng = String(form.get("longitude") || "");
    const radius = String(form.get("geofenceRadiusM") || "");
    setGeofenceStatus(undefined);
    try {
      await api.updateCheckpoint(checkpointId, {
        latitude: lat ? Number(lat) : null,
        longitude: lng ? Number(lng) : null,
        geofenceRadiusM: radius ? Number(radius) : null,
      });
      setGeofenceStatus("Geofence saved");
      await loadCheckpoints();
    } catch (err) {
      setGeofenceStatus(err instanceof Error ? err.message : "Could not save geofence");
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Patrols</h1>
          <p>Define checkpoints per site, and see whether the round actually got walked.</p>
        </div>
      </div>

      {sites.length === 0 ? (
        <div className="card empty-state">
          <p>Add a site first, then you can define checkpoints against it.</p>
        </div>
      ) : (
        <>
          <div className="form-field" style={{ maxWidth: 240 }}>
            <label htmlFor="patrolSiteFilter">Site</label>
            <select id="patrolSiteFilter" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="error-text">{error}</p>}

          <div className="card">
            <div className="card-header">
              <h2>Checkpoints</h2>
              <button className="btn btn-secondary" onClick={() => setShowAddForm((v) => !v)}>
                {!showAddForm && <PlusIcon width={14} height={14} />}
                {showAddForm ? "Cancel" : "Add checkpoint"}
              </button>
            </div>

            {showAddForm && (
              <form onSubmit={handleAdd} style={{ marginBottom: 16 }}>
                <div className="form-field">
                  <label htmlFor="checkpointName">Name</label>
                  <input id="checkpointName" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="form-field">
                  <label htmlFor="checkpointDescription">Description (optional)</label>
                  <input
                    id="checkpointDescription"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Adding…" : "Add"}
                </button>
              </form>
            )}

            {checkpoints.length === 0 ? (
              <p style={{ color: "var(--vetro-text-muted)", fontSize: 14 }}>No checkpoints defined for this site yet.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Description</th>
                    <th>QR code</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {checkpoints.map((cp) => (
                    <Fragment key={cp.id}>
                      <tr>
                        <td>
                          <button
                            type="button"
                            onClick={() => toggleExpand(cp.id)}
                            style={{ border: "none", background: "none", cursor: "pointer", padding: 0, font: "inherit", color: "inherit" }}
                          >
                            {cp.name}
                          </button>
                        </td>
                        <td>{cp.description ?? "—"}</td>
                        <td>
                          <QrCodeCell checkpoint={cp} />
                        </td>
                        <td>
                          <button className="btn btn-secondary" onClick={() => handleDelete(cp.id)}>
                            <TrashIcon width={14} height={14} />
                          </button>
                        </td>
                      </tr>
                      {expandedId === cp.id && (
                        <tr>
                          <td colSpan={4} style={{ background: "var(--vetro-surface-muted)" }}>
                            <div style={{ padding: "12px 0" }}>
                              <p style={{ fontSize: 13, color: "var(--vetro-text-muted)", marginBottom: 12 }}>
                                {cp.geofenceRadiusM != null
                                  ? `Geofence: ${cp.geofenceRadiusM}m radius — scans must happen on site.`
                                  : "No geofence set — scans aren't GPS-verified for this checkpoint."}
                              </p>
                              <form onSubmit={(e) => handleSaveGeofence(e, cp.id)}>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                  <div className="form-field" style={{ flex: 1, minWidth: 140 }}>
                                    <label htmlFor="cpEditLat">Latitude</label>
                                    <input
                                      id="cpEditLat"
                                      name="latitude"
                                      type="number"
                                      step="any"
                                      defaultValue={cp.latitude ?? ""}
                                    />
                                  </div>
                                  <div className="form-field" style={{ flex: 1, minWidth: 140 }}>
                                    <label htmlFor="cpEditLng">Longitude</label>
                                    <input
                                      id="cpEditLng"
                                      name="longitude"
                                      type="number"
                                      step="any"
                                      defaultValue={cp.longitude ?? ""}
                                    />
                                  </div>
                                  <div className="form-field" style={{ flex: 1, minWidth: 140 }}>
                                    <label htmlFor="cpEditRadius">Radius (metres)</label>
                                    <input
                                      id="cpEditRadius"
                                      name="geofenceRadiusM"
                                      type="number"
                                      min="1"
                                      defaultValue={cp.geofenceRadiusM ?? ""}
                                    />
                                  </div>
                                </div>
                                <div style={{ display: "flex", gap: 8 }}>
                                  <button type="button" className="btn btn-secondary" onClick={geoLocation.fill}>
                                    <MapPinIcon width={14} height={14} />
                                    Use my current location
                                  </button>
                                  <button type="submit" className="btn btn-primary">
                                    Save geofence
                                  </button>
                                </div>
                              </form>
                              {geoLocation.status && <p className="subtle-meta">{geoLocation.status}</p>}
                              {geofenceStatus && <p className="subtle-meta">{geofenceStatus}</p>}
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

          <div className="card">
            <div className="card-header">
              <h2>Patrol log</h2>
            </div>
            {scans.length === 0 ? (
              <p style={{ color: "var(--vetro-text-muted)", fontSize: 14 }}>No scans recorded yet.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Checkpoint</th>
                    <th>Officer</th>
                    <th>Scanned</th>
                    <th>GPS</th>
                  </tr>
                </thead>
                <tbody>
                  {scans.map((scan) => (
                    <tr key={scan.id}>
                      <td>{scan.checkpoint?.name ?? "—"}</td>
                      <td>
                        {scan.officer ? `${scan.officer.firstName} ${scan.officer.lastName}` : "—"}
                      </td>
                      <td>{formatDateTime(scan.scannedAt)}</td>
                      <td>{scan.checkpoint?.geofenceRadiusM != null && scan.latitude !== null ? "Verified" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
