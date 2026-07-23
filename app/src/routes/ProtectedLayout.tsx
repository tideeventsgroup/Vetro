import { useEffect, useState } from "react";
import { Navigate, NavLink, Outlet } from "react-router-dom";
import { SidebarIdentity } from "../components/SidebarIdentity.js";
import {
  BarChartIcon,
  CheckIcon,
  ClockIcon,
  MapPinIcon,
  MenuIcon,
  MessageIcon,
  RadarIcon,
  RosterIcon,
  RouteIcon,
  SettingsIcon,
  ShieldCheckIcon,
  SignOutIcon,
  UsersIcon,
  WarningIcon,
} from "../components/icons.js";
import { useApi } from "../lib/api.js";
import { useAuth } from "../lib/auth.js";
import { useTenantSlug } from "../lib/tenant.js";

const ALERT_POLL_MS = 20_000;

export function ProtectedLayout() {
  const { isAuthenticated, isLoading, logout, role } = useAuth();
  const tenant = useTenantSlug();
  const api = useApi();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [openAlertCount, setOpenAlertCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated || role !== "ADMIN") return;
    function poll() {
      void api.listAlerts("OPEN").then((rows) => setOpenAlertCount(rows.length));
    }
    poll();
    const interval = setInterval(poll, ALERT_POLL_MS);
    return () => clearInterval(interval);
  }, [isAuthenticated, role]);

  if (isLoading) return <p style={{ padding: 24, color: "var(--vetro-text-muted)" }}>Loading…</p>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  // This dashboard is the ADMIN-facing side of Vetro — self-service logins
  // belong on their own portals instead (PortalLayout.tsx for officers,
  // ClientLayout.tsx for a site's own contact).
  if (role === "OFFICER") return <Navigate to={`/${tenant}/portal`} replace />;
  if (role === "CLIENT") return <Navigate to={`/${tenant}/client`} replace />;

  return (
    <div className="app-shell has-tab-bar">
      {mobileNavOpen && <div className="app-sidebar-scrim" onClick={() => setMobileNavOpen(false)} />}
      <aside className={`app-sidebar${mobileNavOpen ? " open" : ""}`}>
        <img src="/brand/vetro-logo-horizontal.svg" alt="Vetro" height="40" className="sidebar-logo" />
        <nav className="app-nav" onClick={() => setMobileNavOpen(false)}>
          <span className="app-nav-section">Overview</span>
          <NavLink to={`/${tenant}`} end>
            <RadarIcon />
            Live ops
            {openAlertCount > 0 && <span className="nav-badge">{openAlertCount}</span>}
          </NavLink>
          <NavLink to={`/${tenant}/compliance`}>
            <RosterIcon />
            Compliance dashboard
          </NavLink>
          <NavLink to={`/${tenant}/alerts`}>
            <WarningIcon />
            Alerts center
            {openAlertCount > 0 && <span className="nav-badge">{openAlertCount}</span>}
          </NavLink>
          <NavLink to={`/${tenant}/vetting`}>
            <ShieldCheckIcon />
            Vetting
          </NavLink>
          <NavLink to={`/${tenant}/staff`}>
            <UsersIcon />
            Staff directory
          </NavLink>

          <span className="app-nav-section">Operations</span>
          <NavLink to={`/${tenant}/sites`}>
            <MapPinIcon />
            Sites
          </NavLink>
          <NavLink to={`/${tenant}/occupancy`}>
            <RadarIcon />
            Live site occupancy
          </NavLink>
          <NavLink to={`/${tenant}/arbitration`}>
            <CheckIcon />
            Arbitration queue
          </NavLink>
          <NavLink to={`/${tenant}/incidents`}>
            <WarningIcon />
            Incidents
          </NavLink>
          <NavLink to={`/${tenant}/patrols`}>
            <RouteIcon />
            Patrols
          </NavLink>
          <NavLink to={`/${tenant}/visitor-log`}>
            <UsersIcon />
            Visitor log
          </NavLink>
          <NavLink to={`/${tenant}/dispatch`}>
            <MessageIcon />
            Dispatch
          </NavLink>

          <span className="app-nav-section">Insights</span>
          <NavLink to={`/${tenant}/reports`}>
            <BarChartIcon />
            Reports
          </NavLink>
          <NavLink to={`/${tenant}/audit-log`}>
            <ClockIcon />
            Audit log
          </NavLink>

          <span className="app-nav-section">Admin</span>
          <NavLink to={`/${tenant}/team`}>
            <UsersIcon />
            Team
          </NavLink>
          <NavLink to={`/${tenant}/settings`}>
            <SettingsIcon />
            Settings
          </NavLink>
        </nav>
        <SidebarIdentity />
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
      <nav className="mobile-tab-bar">
        <NavLink to={`/${tenant}`} end className="mobile-tab">
          <RadarIcon />
          <span>Live ops</span>
        </NavLink>
        <NavLink to={`/${tenant}/sites`} className="mobile-tab">
          <MapPinIcon />
          <span>Sites</span>
        </NavLink>
        <NavLink to={`/${tenant}/incidents`} className="mobile-tab">
          <WarningIcon />
          <span>Incidents</span>
        </NavLink>
        <NavLink to={`/${tenant}/reports`} className="mobile-tab">
          <BarChartIcon />
          <span>Reports</span>
        </NavLink>
        <button type="button" className="mobile-tab" onClick={() => setMobileNavOpen(true)}>
          <MenuIcon />
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}
