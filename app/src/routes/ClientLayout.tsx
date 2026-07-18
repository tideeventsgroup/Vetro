import { useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { SidebarIdentity } from "../components/SidebarIdentity.js";
import { MenuIcon, SignOutIcon } from "../components/icons.js";
import { useAuth } from "../lib/auth.js";
import { useTenantSlug } from "../lib/tenant.js";

export function ClientLayout() {
  const { isAuthenticated, isLoading, logout, role } = useAuth();
  const tenant = useTenantSlug();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (isLoading) return <p style={{ padding: 24, color: "var(--vetro-text-muted)" }}>Loading…</p>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  // The client portal is scoped to CLIENT logins only — an org admin
  // visiting /client by mistake belongs on the dashboard instead.
  if (role !== "CLIENT") return <Navigate to={`/${tenant}`} replace />;

  return (
    <div className="app-shell">
      <button
        type="button"
        className="mobile-nav-toggle"
        aria-label="Toggle navigation"
        onClick={() => setMobileNavOpen((v) => !v)}
      >
        <MenuIcon />
      </button>
      {mobileNavOpen && <div className="app-sidebar-scrim" onClick={() => setMobileNavOpen(false)} />}
      <aside className={`app-sidebar${mobileNavOpen ? " open" : ""}`}>
        <img src="/brand/vetro-logo-horizontal-dark.svg" alt="Vetro" height="40" className="sidebar-logo" />
        <div style={{ flex: 1 }} />
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
    </div>
  );
}
