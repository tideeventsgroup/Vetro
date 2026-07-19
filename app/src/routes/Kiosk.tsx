import { FormEvent, useState } from "react";
import { RadarIcon } from "../components/icons.js";
import { useApi } from "../lib/api.js";
import { getGpsPosition } from "../lib/geo.js";

// A shared site device — a tablet on the wall, a phone at reception — that
// any vetted officer can use to book on/off with just their PIN, without
// signing into their own Cognito login. See routes/kiosk.ts on the backend:
// the SIN below resolves which tenant + site this is, then the PIN resolves
// the officer, and vetting status is checked live at that moment.
export function Kiosk() {
  const api = useApi();
  const [site, setSite] = useState<{ sin: string; name: string; organisationName: string } | undefined>(
    undefined
  );
  const [sinInput, setSinInput] = useState("");
  const [sinError, setSinError] = useState<string | undefined>(undefined);
  const [isResolvingSin, setIsResolvingSin] = useState(false);

  const [pin, setPin] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ kind: "on" | "off"; message: string } | undefined>(undefined);
  const [pinError, setPinError] = useState<string | undefined>(undefined);

  async function handleResolveSin(e: FormEvent) {
    e.preventDefault();
    const sin = sinInput.trim().toUpperCase();
    if (!sin) return;
    setSinError(undefined);
    setIsResolvingSin(true);
    try {
      const resolved = await api.getKioskSite(sin);
      setSite({ sin, name: resolved.siteName, organisationName: resolved.organisationName });
    } catch (err) {
      setSinError(err instanceof Error ? err.message : "Could not find this site");
    } finally {
      setIsResolvingSin(false);
    }
  }

  async function handleBook(action: "on" | "off") {
    if (!site || pin.length < 4) return;
    setPinError(undefined);
    setResult(undefined);
    setIsSubmitting(true);
    try {
      const gps = await getGpsPosition();
      const input = { sin: site.sin, pin, lat: gps?.lat, lng: gps?.lng, accuracyM: gps?.accuracyM };
      const response = action === "on" ? await api.kioskBookOn(input) : await api.kioskBookOff(input);
      setResult({
        kind: action,
        message:
          action === "on"
            ? `${response.officerName} booked on at ${response.siteName}.`
            : `${response.officerName} booked off at ${response.siteName}.`,
      });
      setPin("");
    } catch (err) {
      setPinError(err instanceof Error ? err.message : `Could not book ${action}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="kiosk-shell">
      <div className="kiosk-card">
        <span className="empty-icon" style={{ background: "var(--vetro-teal-light)", color: "var(--vetro-teal-dark)", margin: "0 auto 16px" }}>
          <RadarIcon width={28} height={28} />
        </span>

        {!site ? (
          <>
            <h1 className="kiosk-title">Site check-in</h1>
            <p className="kiosk-subtitle">Enter this site's SIN to get started.</p>
            <form onSubmit={handleResolveSin}>
              {sinError && <p className="error-text">{sinError}</p>}
              <input
                className="kiosk-code-input"
                value={sinInput}
                onChange={(e) => setSinInput(e.target.value.toUpperCase())}
                placeholder="SIN"
                autoFocus
                maxLength={8}
              />
              <button type="submit" className="btn btn-primary btn-pill" style={{ width: "100%" }} disabled={isResolvingSin}>
                {isResolvingSin ? "Checking…" : "Continue"}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="kiosk-title">{site.name}</h1>
            <p className="kiosk-subtitle">{site.organisationName}</p>

            {result && <p className="kiosk-result">{result.message}</p>}
            {pinError && <p className="error-text">{pinError}</p>}

            <input
              className="kiosk-code-input"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="PIN"
              inputMode="numeric"
              autoFocus
              maxLength={6}
            />

            <div style={{ display: "flex", gap: 12 }}>
              <button
                type="button"
                className="btn btn-primary btn-pill"
                style={{ flex: 1 }}
                onClick={() => handleBook("on")}
                disabled={isSubmitting || pin.length < 4}
              >
                {isSubmitting ? "Please wait…" : "Book on"}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-pill"
                style={{ flex: 1 }}
                onClick={() => handleBook("off")}
                disabled={isSubmitting || pin.length < 4}
              >
                {isSubmitting ? "Please wait…" : "Book off"}
              </button>
            </div>

            <button
              type="button"
              className="kiosk-change-site"
              onClick={() => {
                setSite(undefined);
                setSinInput("");
                setPin("");
                setResult(undefined);
                setPinError(undefined);
              }}
            >
              Not your site? Change SIN
            </button>
          </>
        )}
      </div>
    </div>
  );
}
