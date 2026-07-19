import { useEffect, useState } from "react";

// Tracks browser connectivity so the officer portal can show an offline
// banner — a field officer's signal drops constantly, and silently failing
// requests are worse than telling them plainly what's going on.
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const setOnline = () => setIsOnline(true);
    const setOffline = () => setIsOnline(false);
    window.addEventListener("online", setOnline);
    window.addEventListener("offline", setOffline);
    return () => {
      window.removeEventListener("online", setOnline);
      window.removeEventListener("offline", setOffline);
    };
  }, []);

  return isOnline;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "vetro-install-dismissed";

// Captures the browser's install prompt (fired once per session at most, per
// the spec) so we can offer our own "Install" button instead of relying on
// the browser's own UI, which many users never notice. Dismissal is
// remembered in localStorage so the banner doesn't nag on every visit; once
// dismissed, `deferredEvent` is cleared rather than kept alongside a second
// "dismissed" flag, so `canInstall` only ever depends on one piece of state.
export function useInstallPrompt() {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | undefined>(undefined);

  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    if (isStandalone || localStorage.getItem(DISMISS_KEY) === "true") return;

    function handler(e: Event) {
      e.preventDefault();
      setDeferredEvent(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function promptInstall() {
    if (!deferredEvent) return;
    await deferredEvent.prompt();
    await deferredEvent.userChoice;
    setDeferredEvent(undefined);
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "true");
    setDeferredEvent(undefined);
  }

  return { canInstall: Boolean(deferredEvent), promptInstall, dismiss };
}
