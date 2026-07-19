import { useEffect, useState } from "react";

// Total time the splash stays fully on top before the fade-out begins, and
// how long that fade takes — six seconds on screen, as requested, with the
// last half-second spent crossfading into the app underneath rather than
// cutting instantly.
const HOLD_MS = 5500;
const FADE_MS = 500;

const SESSION_KEY = "vetro-splash-shown";

function isStandaloneDisplay(): boolean {
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return window.matchMedia("(display-mode: standalone)").matches || iosStandalone;
}

type Phase = "hidden" | "visible" | "fading";

function initialPhase(): Phase {
  if (typeof window === "undefined") return "hidden";
  // Only the installed app gets a launch splash — a browser tab reload
  // blocking on this every time would just be an obstacle, not a welcome.
  if (!isStandaloneDisplay()) return "hidden";
  // sessionStorage survives in-app navigation (so routing around the SPA
  // can't retrigger it) but is cleared on a genuine cold launch, when the OS
  // tears down and relaunches the webview — exactly the moment this should
  // reappear.
  if (sessionStorage.getItem(SESSION_KEY)) return "hidden";
  // Six seconds of motion is exactly what prefers-reduced-motion exists to
  // skip — go straight to the app rather than holding on a static frame.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "hidden";
  return "visible";
}

// The installed PWA's cold-launch splash: the V mark draws itself in, then
// radar-style verification rings pulse outward around it for the rest of
// the six seconds on screen — a nod to Live Ops' own radar iconography and
// "verified, not assumed" — before the whole thing crossfades away to
// reveal the app, which has been mounting underneath the whole time so
// there's no extra wait stacked on top of this.
export function SplashScreen() {
  const [phase, setPhase] = useState<Phase>(initialPhase);

  useEffect(() => {
    if (phase !== "visible") return;
    sessionStorage.setItem(SESSION_KEY, "1");
    const fadeTimer = setTimeout(() => setPhase("fading"), HOLD_MS);
    const hideTimer = setTimeout(() => setPhase("hidden"), HOLD_MS + FADE_MS);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
    // Deliberately mount-once: this reads the "visible" starting phase set
    // by initialPhase() above. Depending on `phase` here would re-run the
    // effect (and its cleanup) the moment fadeTimer flips it to "fading" —
    // cancelling hideTimer before it ever fires, so the overlay would never
    // unmount and would sit invisibly over the whole screen, blocking every
    // click on the app underneath forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === "hidden") return null;

  return (
    <div className={`pwa-splash${phase === "fading" ? " pwa-splash-fading" : ""}`} aria-hidden="true">
      <div className="pwa-splash-mark-wrap">
        <span className="pwa-splash-glow" />
        <span className="pwa-splash-ring" />
        <span className="pwa-splash-ring pwa-splash-ring-2" />
        <svg className="pwa-splash-mark" width="140" height="134" viewBox="30 2 110 106">
          <line className="pwa-splash-stroke pwa-splash-stroke-1" x1="46" y1="18" x2="85" y2="95" strokeWidth="20" strokeLinecap="round" />
          <line className="pwa-splash-stroke pwa-splash-stroke-2" x1="124" y1="18" x2="85" y2="95" strokeWidth="20" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}
