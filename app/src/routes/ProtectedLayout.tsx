import { useState } from "react";
import { Navigate, NavLink, Outlet } from "react-router-dom";
import { SidebarIdentity } from "../components/SidebarIdentity.js";
import { ClockIcon, FileIcon, LockIcon, MenuIcon, SettingsIcon, ShieldCheckIcon, SignOutIcon, UsersIcon } from "../components/icons.js";
import { useAuth } from "../lib/auth.js";
import { useTenantSlug } from "../lib/tenant.js";

export function ProtectedLayout() {
  const { isAuthenticated, isLoading, role, logout } = useAuth();
  const tenant = useTenantSlug();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isAdmin = role === "ADMIN";

  if (isLoading) return <p style={{ padding: 24, color: "var(--lunara-text-muted)" }}>Loading…</p>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div className="app-shell has-tab-bar">
      {mobileNavOpen && <div className="app-sidebar-scrim" onClick={() => setMobileNavOpen(false)} />}
      <aside className={`app-sidebar${mobileNavOpen ? " open" : ""}`}>
        <img src="/brand/lunara-logo-horizontal.svg" alt="Lunara Screening" height="40" className="sidebar-logo" />
        <nav className="app-nav" onClick={() => setMobileNavOpen(false)}>
          <span className="app-nav-section">Compliance</span>
          <NavLink to={`/${tenant}`} end>
            <ShieldCheckIcon />
            Candidates
          </NavLink>
          <NavLink to={`/${tenant}/role-types`}>
            <FileIcon />
            Role types
          </NavLink>
          <NavLink to={`/${tenant}/audit-log`}>
            <ClockIcon />
            Audit log
          </NavLink>
          {isAdmin && (
            <NavLink to={`/${tenant}/data-requests`}>
              <LockIcon />
              Data requests
            </NavLink>
          )}

          {isAdmin && (
            <>
              <span className="app-nav-section">Admin</span>
              <NavLink to={`/${tenant}/team`}>
                <UsersIcon />
                Team
              </NavLink>
              <NavLink to={`/${tenant}/settings`}>
                <SettingsIcon />
                Settings
              </NavLink>
            </>
          )}
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
          <ShieldCheckIcon />
          <span>Candidates</span>
        </NavLink>
        <NavLink to={`/${tenant}/role-types`} className="mobile-tab">
          <FileIcon />
          <span>Roles</span>
        </NavLink>
        <NavLink to={`/${tenant}/audit-log`} className="mobile-tab">
          <ClockIcon />
          <span>Audit log</span>
        </NavLink>
        <button type="button" className="mobile-tab" onClick={() => setMobileNavOpen(true)}>
          <MenuIcon />
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}
