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
