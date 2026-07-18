import { Navigate } from "react-router-dom";

const DEV_TENANT_SLUG = import.meta.env.VITE_DEV_TENANT_SLUG;

/**
 * Landing for a bare "/" — with no custom domain yet, there's no subdomain
 * to read a tenant from, so every real route lives under /:tenant instead
 * (see App.tsx). VITE_DEV_TENANT_SLUG short-circuits this for local dev.
 */
export function NoTenant() {
  if (DEV_TENANT_SLUG) return <Navigate to={`/${DEV_TENANT_SLUG}`} replace />;

  return (
    <div style={{ maxWidth: 440, margin: "96px auto", textAlign: "center", padding: 24 }}>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Vetro</h1>
      <p style={{ color: "var(--vetro-text-muted)" }}>
        Visit your organisation's own link to sign in — for example
        <br />
        <code>{window.location.origin}/clyde-coast</code>.
      </p>
    </div>
  );
}
