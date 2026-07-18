import { useState } from "react";
import { Navigate, NavLink, Outlet } from "react-router-dom";
import { SidebarIdentity } from "../components/SidebarIdentity.js";
import {
  CalendarIcon,
  HomeIcon,
  MenuIcon,
  RouteIcon,
  ShieldCheckIcon,
  SignOutIcon,
  UsersIcon,
  WarningIcon,
} from "../components/icons.js";
import { useAuth } from "../lib/auth.js";
import { useTenantSlug } from "../lib/tenant.js";

export function PortalLayout() {
  const { isAuthenticated, isLoading, logout, role } = useAuth();
  const tenant = useTenantSlug();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (isLoading) return <p style={{ padding: 24, color: "var(--vetro-text-muted)" }}>Loading…</p>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  // The officer self-service portal is scoped to OFFICER logins only — an
  // org admin visiting /portal by mistake belongs on the dashboard instead.
  if (role !== "OFFICER") return <Navigate to={`/${tenant}`} replace />;

  return (
    <div className="app-shell has-tab-bar">
      {mobileNavOpen && <div className="app-sidebar-scrim" onClick={() => setMobileNavOpen(false)} />}
      <aside className={`app-sidebar${mobileNavOpen ? " open" : ""}`}>
        <img src="/brand/vetro-logo-horizontal-dark.svg" alt="Vetro" height="40" className="sidebar-logo" />
        <nav className="app-nav" onClick={() => setMobileNavOpen(false)}>
          <NavLink to={`/${tenant}/portal`} end>
            <HomeIcon />
            Home
          </NavLink>
          <NavLink to={`/${tenant}/portal/shifts`}>
            <CalendarIcon />
            My shifts
          </NavLink>
          <NavLink to={`/${tenant}/portal/incidents`}>
            <WarningIcon />
            Incidents
          </NavLink>
          <NavLink to={`/${tenant}/portal/patrols`}>
            <RouteIcon />
            Patrols
          </NavLink>
          <NavLink to={`/${tenant}/portal/visitor-log`}>
            <UsersIcon />
            Visitor log
          </NavLink>
          <NavLink to={`/${tenant}/portal/vetting`}>
            <ShieldCheckIcon />
            Vetting
          </NavLink>
        </nav>
        <SidebarIdentity />
        <div className="app-sidebar-footer">
          <a href="#" onClick={logout}>
            <SignOutIcon />
            Sign out
          </a>
          <p className="sidebar-disclaimer">
            Checks run against the SIA public register — not an official SIA integration.
          </p>
        </div>
      </aside>
      <main className="app-main">
        <Outlet />
      </main>
      <nav className="mobile-tab-bar">
        <NavLink to={`/${tenant}/portal`} end className="mobile-tab">
          <HomeIcon />
          <span>Home</span>
        </NavLink>
        <NavLink to={`/${tenant}/portal/shifts`} className="mobile-tab">
          <CalendarIcon />
          <span>Shifts</span>
        </NavLink>
        <NavLink to={`/${tenant}/portal/incidents`} className="mobile-tab">
          <WarningIcon />
          <span>Incidents</span>
        </NavLink>
        <button type="button" className="mobile-tab" onClick={() => setMobileNavOpen(true)}>
          <MenuIcon />
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}
