import { useState } from "react";
import { ClockGps } from "./api.js";

// Best-effort GPS read — resolves with undefined rather than rejecting when
// location is unsupported, denied, or slow. Used for clock-in/out, incident
// reports, and checkpoint scans, none of which should be blocked by missing
// GPS unless the specific site/checkpoint enforces a geofence server-side.
export function getGpsPosition(): Promise<ClockGps | undefined> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) {
      resolve(undefined);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyM: position.coords.accuracy,
        }),
      () => resolve(undefined),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  });
}

// Fills a pair of lat/lng inputs from the browser's own location — the
// fastest way for whoever's setting up a site or checkpoint to get an
// accurate geofence centre without looking up coordinates by hand. Shared by
// Sites.tsx and Patrols.tsx, which both had their own copy of this before.
export function useCurrentLocation(latInputId: string, lngInputId: string) {
  const [status, setStatus] = useState<string | undefined>(undefined);

  function fill() {
    if (!("geolocation" in navigator)) {
      setStatus("Location isn't available in this browser");
      return;
    }
    setStatus("Locating…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latInput = document.getElementById(latInputId) as HTMLInputElement | null;
        const lngInput = document.getElementById(lngInputId) as HTMLInputElement | null;
        if (latInput) latInput.value = position.coords.latitude.toFixed(6);
        if (lngInput) lngInput.value = position.coords.longitude.toFixed(6);
        setStatus(undefined);
      },
      () => setStatus("Could not read your location — enter coordinates manually"),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  return { fill, status };
}
