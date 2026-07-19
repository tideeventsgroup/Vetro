import { haversineDistanceM } from "./geo.js";

// Shared by routes/me.ts (Cognito-authenticated clock-in/out and checkpoint
// scans) and routes/kiosk.ts (PIN/SIN book-on/off with no Cognito session at
// all) — both need the exact same "is this GPS fix inside the site/
// checkpoint's geofence" check.
export interface ClockGpsBody {
  lat?: number;
  lng?: number;
  accuracyM?: number;
}

// A site/checkpoint only enforces its geofence once an admin has actually
// set coordinates + a radius for it — one without that configured never
// blocks on missing GPS, so this stays opt-in per site/checkpoint.
export function checkGeofence(
  place: { latitude: number | null; longitude: number | null; geofenceRadiusM: number | null },
  gps: ClockGpsBody,
  action = "clock in/out at this site"
): { distanceM: number | null; error?: string } {
  const geofenced =
    place.latitude !== null && place.longitude !== null && place.geofenceRadiusM !== null;
  if (!geofenced) return { distanceM: null };

  if (gps.lat === undefined || gps.lng === undefined) {
    return { distanceM: null, error: `Location is required to ${action}` };
  }

  const distanceM = haversineDistanceM(place.latitude!, place.longitude!, gps.lat, gps.lng);
  if (distanceM > place.geofenceRadiusM!) {
    return {
      distanceM,
      error: `Too far away to ${action} — you're ${Math.round(distanceM)}m away, must be within ${place.geofenceRadiusM}m`,
    };
  }
  return { distanceM };
}
