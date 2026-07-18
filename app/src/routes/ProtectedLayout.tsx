import { Navigate, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth.js";
import { RosterIcon, SignOutIcon } from "../components/icons.js";

export function ProtectedLayout() {
  const { isAuthenticated, isLoading, logout } = useAuth();

  if (isLoading) return <p style={{ padding: 24, color: "var(--vetro-text-muted)" }}>Loading…</p>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <img src="/brand/vetro-logo-horizontal-dark.svg" alt="Vetro" height="22" className="sidebar-logo" />
        <nav className="app-nav">
          <NavLink to="/" end>
            <RosterIcon />
            Roster
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
