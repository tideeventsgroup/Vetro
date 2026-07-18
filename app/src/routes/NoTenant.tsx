import { Navigate } from "react-router-dom";

const DEV_TENANT_SLUG = import.meta.env.VITE_DEV_TENANT_SLUG;

/**
 * Landing for a bare "/" — sign-in itself doesn't need a tenant slug (see
 * App.tsx and Login.tsx), so there's nothing else for this to resolve;
 * it just sends you to /login. VITE_DEV_TENANT_SLUG short-circuits this
 * straight to a specific tenant for local dev convenience.
 */
export function NoTenant() {
  if (DEV_TENANT_SLUG) return <Navigate to={`/${DEV_TENANT_SLUG}`} replace />;
  return <Navigate to="/login" replace />;
}
