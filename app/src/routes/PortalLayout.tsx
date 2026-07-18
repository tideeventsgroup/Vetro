import { Navigate, Outlet } from "react-router-dom";
import { SignOutIcon } from "../components/icons.js";
import { useAuth } from "../lib/auth.js";
import { useTenantSlug } from "../lib/tenant.js";

export function PortalLayout() {
  const { isAuthenticated, isLoading, logout, role } = useAuth();
  const tenant = useTenantSlug();

  if (isLoading) return <p style={{ padding: 24, color: "var(--vetro-text-muted)" }}>Loading…</p>;
  if (!isAuthenticated) return <Navigate to={`/${tenant}/login`} replace />;
  // The officer self-service portal is scoped to OFFICER logins only — an
  // org admin visiting /portal by mistake belongs on the dashboard instead.
  if (role !== "OFFICER") return <Navigate to={`/${tenant}`} replace />;

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <img src="/brand/vetro-logo-horizontal-dark.svg" alt="Vetro" height="22" className="sidebar-logo" />
        <div style={{ flex: 1 }} />
        <div className="app-sidebar-footer">
          <a href="#" onClick={logout}>
            <SignOutIcon />
            Sign out
          </a>
        </div>
      </aside>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
