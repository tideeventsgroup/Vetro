import { FormEvent, useEffect, useState } from "react";
import { PlusIcon, TrashIcon } from "../components/icons.js";
import { Checkpoint, CheckpointScan, Site, useApi } from "../lib/api.js";

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Admin side of the patrol tour: define checkpoints per site, then see
// whether the round actually got walked. Officers scan from the
// self-service portal (routes/MyPatrols.tsx).
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
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {checkpoints.map((cp) => (
                    <tr key={cp.id}>
                      <td>{cp.name}</td>
                      <td>{cp.description ?? "—"}</td>
                      <td>
                        <button className="btn btn-secondary" onClick={() => handleDelete(cp.id)}>
                          <TrashIcon width={14} height={14} />
                        </button>
                      </td>
                    </tr>
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
