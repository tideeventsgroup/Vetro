import { useEffect, useState } from "react";
import { useApi } from "../lib/api.js";
import { getGpsPosition } from "../lib/geo.js";
import { CheckIcon, PhoneCheckIcon } from "./icons.js";

const SENT_DISPLAY_MS = 4_000;

// Routine "I'm OK" welfare check-in — the bottom tab bar's centre action,
// raised above the bar the way many apps highlight a primary action.
// Deliberately no confirm step (compare SosButton's): a false-positive
// check-in is harmless, so "are you sure?" would just be friction on
// something an officer is meant to do routinely. Not gated on vetting
// status, same reasoning as SOS — a safety ping has no business waiting on
// admin paperwork.
export function CheckCallButton() {
  const api = useApi();
  const [sending, setSending] = useState(false);
  const [sentAt, setSentAt] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!sentAt) return;
    const timeout = setTimeout(() => setSentAt(undefined), SENT_DISPLAY_MS);
    return () => clearTimeout(timeout);
  }, [sentAt]);

  async function handleClick() {
    setSending(true);
    setError(undefined);
    try {
      const gps = await getGpsPosition();
      await api.triggerCheckCall(gps);
      setSentAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send check-in");
    } finally {
      setSending(false);
    }
  }

  return (
    <button
      type="button"
      className="mobile-tab mobile-tab-checkcall"
      onClick={handleClick}
      disabled={sending}
      aria-label="Send welfare check-in"
    >
      <span className={`mobile-tab-checkcall-icon${sentAt ? " mobile-tab-checkcall-sent" : ""}`}>
        {sentAt ? <CheckIcon width={20} height={20} /> : <PhoneCheckIcon width={20} height={20} />}
      </span>
      <span>{error ? "Try again" : sentAt ? "Sent" : "Check in"}</span>
    </button>
  );
}
