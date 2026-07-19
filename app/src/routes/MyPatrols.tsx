import { useEffect, useMemo, useState } from "react";
import { QrScanModal } from "../components/QrScanModal.js";
import { CheckIcon, ClockIcon, QrCodeIcon } from "../components/icons.js";
import { Checkpoint, CheckpointScan, Site, useApi } from "../lib/api.js";
import { getGpsPosition } from "../lib/geo.js";

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

// The classic "guard tour" feature — an admin defines checkpoints per site
// (Patrols.tsx), an officer taps "Scan" on reaching each one. No NFC/GPS
// hardware assumed, just a timestamped confirmation the round was walked.
export function MyPatrols() {
  const api = useApi();
  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState("");
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [scans, setScans] = useState<CheckpointScan[]>([]);
  const [scanningId, setScanningId] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [showCameraScan, setShowCameraScan] = useState(false);

  useEffect(() => {
    void loadSites();
  }, []);

  useEffect(() => {
    if (siteId) void loadCheckpoints();
  }, [siteId]);

  async function loadSites() {
    const rows = await api.listMySites();
    setSites(rows);
    if (rows.length > 0) setSiteId(rows[0].id);
    else setIsLoading(false);
  }

  async function loadCheckpoints() {
    setIsLoading(true);
    try {
      const { checkpoints: cps, scans: today } = await api.listMyCheckpoints(siteId);
      setCheckpoints(cps);
      setScans(today);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load checkpoints");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleScan(checkpointId: string) {
    setScanningId(checkpointId);
    setError(undefined);
    try {
      const gps = await getGpsPosition();
      await api.scanMyCheckpoint(checkpointId, gps);
      await loadCheckpoints();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record this scan");
    } finally {
      setScanningId(undefined);
    }
  }

  async function handleQrDetected(qrCode: string) {
    setShowCameraScan(false);
    setError(undefined);
    try {
      const gps = await getGpsPosition();
      await api.scanCheckpointByQrCode(qrCode, gps);
      await loadCheckpoints();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That QR code doesn't match a checkpoint here");
    }
  }

  const latestScanByCheckpoint = useMemo(() => {
    const map = new Map<string, CheckpointScan>();
    for (const scan of scans) {
      const existing = map.get(scan.checkpointId);
      if (!existing || new Date(scan.scannedAt) > new Date(existing.scannedAt)) map.set(scan.checkpointId, scan);
    }
    return map;
  }, [scans]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Patrols</h1>
          <p>Scan each checkpoint as you complete your round — today's scans reset at midnight.</p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-primary" onClick={() => setShowCameraScan(true)}>
            <QrCodeIcon width={14} height={14} />
            Scan with camera
          </button>
        </div>
      </div>

      {showCameraScan && (
        <QrScanModal onDetected={handleQrDetected} onClose={() => setShowCameraScan(false)} />
      )}

      {sites.length === 0 ? (
        <div className="card empty-state">
          <p>You need a shift at a site before you can patrol there.</p>
        </div>
      ) : (
        <>
          <div className="form-field" style={{ maxWidth: 280 }}>
            <label htmlFor="patrolSite">Site</label>
            <select id="patrolSite" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
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
          ) : checkpoints.length === 0 ? (
            <div className="card empty-state">
              <p>No checkpoints set up for this site yet — ask your admin to add some.</p>
            </div>
          ) : (
            <div className="site-grid">
              {checkpoints.map((cp) => {
                const scan = latestScanByCheckpoint.get(cp.id);
                return (
                  <div className="card" key={cp.id}>
                    <div className="site-card-name" style={{ marginBottom: 4 }}>
                      {cp.name}
                    </div>
                    {cp.description && (
                      <p style={{ color: "var(--vetro-text-muted)", fontSize: 13, margin: "0 0 12px" }}>
                        {cp.description}
                      </p>
                    )}
                    {scan ? (
                      <p
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          color: "var(--vetro-status-green-text)",
                          fontSize: 13,
                          margin: 0,
                        }}
                      >
                        <CheckIcon width={14} height={14} /> Scanned at {formatTime(scan.scannedAt)}
                        {cp.geofenceRadiusM != null && scan.latitude !== null && " · GPS verified"}
                      </p>
                    ) : (
                      <button
                        className="btn btn-primary"
                        onClick={() => handleScan(cp.id)}
                        disabled={scanningId === cp.id}
                        style={{ width: "100%" }}
                      >
                        <ClockIcon width={14} height={14} />
                        {scanningId === cp.id ? "Scanning…" : "Scan"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
