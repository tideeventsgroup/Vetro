import { Navigate } from "react-router-dom";

/**
 * Landing for a bare "/" — this is the PWA's start_url (see vite.config.ts),
 * so it's what an installed home-screen icon actually opens to. Lunara has
 * no PIN-based public landing the way old-Vetro did (a candidate's own way
 * in is always their emailed magic link, see routes/CandidateSelfService.tsx,
 * never something typed in at this bare root) — every case just resolves to
 * sign-in, which itself redirects on to the account's own organisation once
 * authenticated.
 */
export function NoTenant() {
  return <Navigate to="/login" replace />;
}
