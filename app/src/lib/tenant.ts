const BASE_DOMAIN = import.meta.env.VITE_BASE_DOMAIN;
const DEV_TENANT_SLUG = import.meta.env.VITE_DEV_TENANT_SLUG;

/**
 * The tenant slug this page is running as — read from the subdomain, e.g.
 * `clyde-coast` from `clyde-coast.vetro.co.uk`. Falls back to
 * VITE_DEV_TENANT_SLUG for plain `localhost`, since that has no subdomain
 * to read. To develop against a *different* tenant locally, run the app at
 * `http://<slug>.localhost:5173` instead — browsers resolve `*.localhost`
 * to loopback natively, no /etc/hosts edit needed.
 */
export function getTenantSlug(): string | undefined {
  const hostname = window.location.hostname;

  if (BASE_DOMAIN && hostname.endsWith(`.${BASE_DOMAIN}`)) {
    return hostname.slice(0, -(BASE_DOMAIN.length + 1));
  }

  if (hostname.endsWith(".localhost")) {
    return hostname.slice(0, -".localhost".length);
  }

  return DEV_TENANT_SLUG || undefined;
}
