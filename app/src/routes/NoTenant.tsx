import { Navigate } from "react-router-dom";
import { getTenantSlug } from "../lib/tenant.js";

/**
 * Landing for a bare "/" — this is the PWA's start_url (see vite.config.ts),
 * so it's what an installed home-screen icon actually opens to. A tenant
 * subdomain (clyde-coast.vetro.co.uk, or VITE_DEV_TENANT_SLUG locally)
 * resolves straight through getTenantSlug() even with no path segment, so
 * this sends staff straight to their tenant's PIN-based vetting login
 * (routes/PinAccess.tsx) rather than the admin sign-in — PinAccess itself
 * links through to /login for anyone who does need the admin console. A
 * bare marketing/apex domain has no tenant to resolve at all, so that case
 * still falls back to /login.
 */
export function NoTenant() {
  const tenant = getTenantSlug();
  if (tenant) return <Navigate to={`/${tenant}/pin-access`} replace />;
  return <Navigate to="/login" replace />;
}
