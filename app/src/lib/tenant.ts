import { useParams } from "react-router-dom";

const BASE_DOMAIN = import.meta.env.VITE_BASE_DOMAIN;
const DEV_TENANT_SLUG = import.meta.env.VITE_DEV_TENANT_SLUG;

/**
 * The tenant slug this page is running as. Subdomain (`clyde-coast` from
 * `clyde-coast.vetro.co.uk`) takes priority for whenever a custom domain
 * exists; until then, every route is nested under `/:tenant` (see
 * App.tsx), so the first path segment is the tenant instead — e.g.
 * `.../clyde-coast/officers/1`. Falls back to VITE_DEV_TENANT_SLUG only for
 * bare `localhost` with no path, which NoTenant.tsx redirects from.
 */
export function getTenantSlug(): string | undefined {
  const hostname = window.location.hostname;

  if (BASE_DOMAIN && hostname.endsWith(`.${BASE_DOMAIN}`)) {
    return hostname.slice(0, -(BASE_DOMAIN.length + 1));
  }

  if (hostname.endsWith(".localhost")) {
    return hostname.slice(0, -".localhost".length);
  }

  const pathTenant = window.location.pathname.split("/")[1];
  if (pathTenant) return pathTenant;

  return DEV_TENANT_SLUG || undefined;
}

/** Same tenant slug, read reactively from the `/:tenant` route param — use this inside components. */
export function useTenantSlug(): string {
  const { tenant } = useParams<{ tenant: string }>();
  return tenant ?? "";
}
