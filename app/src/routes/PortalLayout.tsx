import { useEffect, useState } from "react";
import { Link, Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { SidebarIdentity } from "../components/SidebarIdentity.js";
import {
  CalendarIcon,
  HomeIcon,
  LockIcon,
  MenuIcon,
  RouteIcon,
  ShieldCheckIcon,
  SignOutIcon,
  UsersIcon,
  WarningIcon,
} from "../components/icons.js";
import { useAuth } from "../lib/auth.js";
import { Officer, useApi } from "../lib/api.js";
import { useTenantSlug } from "../lib/tenant.js";

// Segments that stay locked until vetting is complete — everything
// operational (shifts, incidents, patrols, visitor log). Home and Vetting
// itself are never locked: an officer needs both to actually get vetted.
const LOCKED_SEGMENTS = ["shifts", "incidents", "patrols", "visitor-log"];

function LockedNotice({ tenant }: { tenant: string | undefined }) {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Locked</h1>
          <p>This page unlocks once your vetting is complete.</p>
        </div>
      </div>
      <div className="card empty-state">
        <span className="empty-icon">
          <LockIcon />
        </span>
        <p>Complete your vetting before you can check shifts, file incidents, patrol, or log visitors.</p>
        <Link to={`/${tenant}/portal/vetting`} className="btn btn-primary" style={{ marginTop: 16 }}>
          Complete vetting now
        </Link>
      </div>
    </div>
  );
}

export function PortalLayout() {
  const { isAuthenticated, isLoading, logout, role } = useAuth();
  const api = useApi();
  const tenant = useTenantSlug();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [officer, setOfficer] = useState<Officer | undefined>(undefined);
  const [isLoadingOfficer, setIsLoadingOfficer] = useState(true);

  useEffect(() => {
    void api
      .getMyOfficer()
      .then(setOfficer)
      .finally(() => setIsLoadingOfficer(false));
  }, []);

  if (isLoading) return <p style={{ padding: 24, color: "var(--vetro-text-muted)" }}>Loading…</p>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  // The officer self-service portal is scoped to OFFICER logins only — an
  // org admin visiting /portal by mistake belongs on the dashboard instead.
  if (role !== "OFFICER") return <Navigate to={`/${tenant}`} replace />;

  const vettingCompleted = (officer?.vettingRecords.length ?? 0) > 0;
  const currentSegment = location.pathname.split("/").filter(Boolean).pop();
  const onLockedPath = LOCKED_SEGMENTS.includes(currentSegment ?? "");

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
          {vettingCompleted ? (
            <NavLink to={`/${tenant}/portal/shifts`}>
              <CalendarIcon />
              My shifts
            </NavLink>
          ) : (
            <span className="app-nav-locked" aria-disabled="true">
              <CalendarIcon />
              My shifts
              <LockIcon width={13} height={13} />
            </span>
          )}
          {vettingCompleted ? (
            <NavLink to={`/${tenant}/portal/incidents`}>
              <WarningIcon />
              Incidents
            </NavLink>
          ) : (
            <span className="app-nav-locked" aria-disabled="true">
              <WarningIcon />
              Incidents
              <LockIcon width={13} height={13} />
            </span>
          )}
          {vettingCompleted ? (
            <NavLink to={`/${tenant}/portal/patrols`}>
              <RouteIcon />
              Patrols
            </NavLink>
          ) : (
            <span className="app-nav-locked" aria-disabled="true">
              <RouteIcon />
              Patrols
              <LockIcon width={13} height={13} />
            </span>
          )}
          {vettingCompleted ? (
            <NavLink to={`/${tenant}/portal/visitor-log`}>
              <UsersIcon />
              Visitor log
            </NavLink>
          ) : (
            <span className="app-nav-locked" aria-disabled="true">
              <UsersIcon />
              Visitor log
              <LockIcon width={13} height={13} />
            </span>
          )}
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
        {isLoadingOfficer ? (
          <p style={{ color: "var(--vetro-text-muted)" }}>Loading…</p>
        ) : !vettingCompleted && onLockedPath ? (
          <LockedNotice tenant={tenant} />
        ) : (
          <Outlet />
        )}
      </main>
      <nav className="mobile-tab-bar">
        <NavLink to={`/${tenant}/portal`} end className="mobile-tab">
          <HomeIcon />
          <span>Home</span>
        </NavLink>
        {vettingCompleted ? (
          <NavLink to={`/${tenant}/portal/shifts`} className="mobile-tab">
            <CalendarIcon />
            <span>Shifts</span>
          </NavLink>
        ) : (
          <span className="mobile-tab mobile-tab-locked" aria-disabled="true">
            <LockIcon />
            <span>Shifts</span>
          </span>
        )}
        {vettingCompleted ? (
          <NavLink to={`/${tenant}/portal/incidents`} className="mobile-tab">
            <WarningIcon />
            <span>Incidents</span>
          </NavLink>
        ) : (
          <span className="mobile-tab mobile-tab-locked" aria-disabled="true">
            <LockIcon />
            <span>Incidents</span>
          </span>
        )}
        <button type="button" className="mobile-tab" onClick={() => setMobileNavOpen(true)}>
          <MenuIcon />
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}
