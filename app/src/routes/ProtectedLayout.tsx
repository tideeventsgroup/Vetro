import { Navigate, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth.js";
import { useTenantSlug } from "../lib/tenant.js";
import { RosterIcon, SignOutIcon, UsersIcon } from "../components/icons.js";

export function ProtectedLayout() {
  const { isAuthenticated, isLoading, logout, role } = useAuth();
  const tenant = useTenantSlug();

  if (isLoading) return <p style={{ padding: 24, color: "var(--vetro-text-muted)" }}>Loading…</p>;
  if (!isAuthenticated) return <Navigate to={`/${tenant}/login`} replace />;
  // This dashboard is the ADMIN-facing side of Vetro — an officer's own
  // self-service login belongs on /portal instead (see PortalLayout.tsx).
  if (role === "OFFICER") return <Navigate to={`/${tenant}/portal`} replace />;

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <img src="/brand/vetro-logo-horizontal-dark.svg" alt="Vetro" height="22" className="sidebar-logo" />
        <nav className="app-nav">
          <NavLink to={`/${tenant}`} end>
            <RosterIcon />
            Roster
          </NavLink>
          <NavLink to={`/${tenant}/team`}>
            <UsersIcon />
            Team
          </NavLink>
        </nav>
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
