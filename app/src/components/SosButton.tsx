import { useEffect, useState } from "react";
import { useApi } from "../lib/api.js";
import { getGpsPosition } from "../lib/geo.js";
import { CheckIcon, SirenIcon } from "./icons.js";

const SENT_DISPLAY_MS = 8_000;

// Lone-worker panic button — fixed and always rendered by PortalLayout
// regardless of vetting status (safety has no business waiting on admin
// paperwork; see routes/me.ts's POST /sos, deliberately outside the
// requireVettingCompleted gate). A confirm step guards against an accidental
// tap turning into a false emergency dispatch.
export function SosButton() {
  const api = useApi();
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentAt, setSentAt] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!sentAt) return;
    const timeout = setTimeout(() => setSentAt(undefined), SENT_DISPLAY_MS);
    return () => clearTimeout(timeout);
  }, [sentAt]);

  async function handleConfirmSend() {
    setSending(true);
    setError(undefined);
    try {
      const gps = await getGpsPosition();
      await api.triggerSos(gps);
      setConfirming(false);
      setSentAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the alert — try again");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={`sos-fab${sentAt ? " sos-fab-sent" : ""}`}
        onClick={() => setConfirming(true)}
        aria-label="Send SOS alert"
      >
        {sentAt ? <CheckIcon width={22} height={22} /> : <SirenIcon width={22} height={22} />}
      </button>

      {confirming && (
        <div className="modal-overlay" onClick={() => !sending && setConfirming(false)}>
          <div className="card modal-panel" onClick={(e) => e.stopPropagation()} style={{ width: 360, textAlign: "center" }}>
            <span className="empty-icon" style={{ background: "rgba(196, 52, 43, 0.12)", color: "var(--vetro-status-red)", margin: "0 auto 12px" }}>
              <SirenIcon />
            </span>
            <h2 style={{ fontSize: 18, marginBottom: 8 }}>Send SOS alert?</h2>
            <p style={{ color: "var(--vetro-text-muted)", fontSize: 14, marginBottom: 16 }}>
              This immediately notifies your control room with your current location. Only use this if you need
              help.
            </p>
            {error && <p className="error-text">{error}</p>}
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setConfirming(false)} disabled={sending}>
                Cancel
              </button>
              <button type="button" className="btn btn-sos" onClick={handleConfirmSend} disabled={sending}>
                {sending ? "Sending…" : "Send SOS"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
