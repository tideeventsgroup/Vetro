import { Navigate, Outlet } from "react-router-dom";
import { SignOutIcon } from "../components/icons.js";
import { useAuth } from "../lib/auth.js";
import { useTenantSlug } from "../lib/tenant.js";

export function ClientLayout() {
  const { isAuthenticated, isLoading, logout, role } = useAuth();
  const tenant = useTenantSlug();

  if (isLoading) return <p style={{ padding: 24, color: "var(--vetro-text-muted)" }}>Loading…</p>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  // The client portal is scoped to CLIENT logins only — an org admin
  // visiting /client by mistake belongs on the dashboard instead.
  if (role !== "CLIENT") return <Navigate to={`/${tenant}`} replace />;

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
