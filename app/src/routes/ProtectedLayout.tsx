import { Navigate, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth.js";
import { useTenantSlug } from "../lib/tenant.js";
import {
  BarChartIcon,
  CalendarIcon,
  ClockIcon,
  MapPinIcon,
  RosterIcon,
  SettingsIcon,
  ShieldCheckIcon,
  SignOutIcon,
  UsersIcon,
} from "../components/icons.js";

export function ProtectedLayout() {
  const { isAuthenticated, isLoading, logout, role } = useAuth();
  const tenant = useTenantSlug();

  if (isLoading) return <p style={{ padding: 24, color: "var(--vetro-text-muted)" }}>Loading…</p>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  // This dashboard is the ADMIN-facing side of Vetro — self-service logins
  // belong on their own portals instead (PortalLayout.tsx for officers,
  // ClientLayout.tsx for a site's own contact).
  if (role === "OFFICER") return <Navigate to={`/${tenant}/portal`} replace />;
  if (role === "CLIENT") return <Navigate to={`/${tenant}/client`} replace />;

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <img src="/brand/vetro-logo-horizontal-dark.svg" alt="Vetro" height="22" className="sidebar-logo" />
        <nav className="app-nav">
          <NavLink to={`/${tenant}`} end>
            <RosterIcon />
            Roster
          </NavLink>
          <NavLink to={`/${tenant}/vetting-queue`}>
            <ShieldCheckIcon />
            Vetting queue
          </NavLink>
          <NavLink to={`/${tenant}/sites`}>
            <MapPinIcon />
            Sites
          </NavLink>
          <NavLink to={`/${tenant}/schedule`}>
            <CalendarIcon />
            Schedule
          </NavLink>
          <NavLink to={`/${tenant}/reports`}>
            <BarChartIcon />
            Reports
          </NavLink>
          <NavLink to={`/${tenant}/team`}>
            <UsersIcon />
            Team
          </NavLink>
          <NavLink to={`/${tenant}/audit-log`}>
            <ClockIcon />
            Audit log
          </NavLink>
          <NavLink to={`/${tenant}/settings`}>
            <SettingsIcon />
            Settings
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
