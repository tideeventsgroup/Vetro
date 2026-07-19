import { useEffect, useState } from "react";
import { Link, Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { CheckCallButton } from "../components/CheckCallButton.js";
import { SidebarIdentity } from "../components/SidebarIdentity.js";
import {
  CalendarIcon,
  DownloadIcon,
  HomeIcon,
  LockIcon,
  MenuIcon,
  MessageIcon,
  RouteIcon,
  ShieldCheckIcon,
  SignOutIcon,
  UsersIcon,
  WarningIcon,
  WifiOffIcon,
  XIcon,
} from "../components/icons.js";
import { useAuth } from "../lib/auth.js";
import { Officer, useApi } from "../lib/api.js";
import { MESSAGES_READ_EVENT } from "../lib/events.js";
import { useInstallPrompt, useOnlineStatus } from "../lib/pwa.js";
import { useTenantSlug } from "../lib/tenant.js";

// Segments that stay locked until vetting is complete — everything
// operational (shifts, incidents, patrols, visitor log). Home, Vetting, and
// Messages are never locked: an officer needs the first two to actually get
// vetted, and dispatch may need to reach an unvetted officer directly (e.g.
// about a vetting appointment), so messaging can't be gated behind it.
export const LOCKED_SEGMENTS = ["shifts", "incidents", "patrols", "visitor-log"];

// How often to poll for new messages while the portal is open. There's no
// websocket/push infra yet, so this is what keeps the unread badge current
// without the officer having to manually refresh.
const MESSAGE_POLL_MS = 60_000;

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

function OfflineBanner() {
  return (
    <div className="portal-status-banner portal-status-banner-offline">
      <WifiOffIcon width={15} height={15} />
      You're offline — some actions won't work until you're back online.
    </div>
  );
}

function InstallBanner({ onInstall, onDismiss }: { onInstall: () => void; onDismiss: () => void }) {
  return (
    <div className="portal-status-banner portal-status-banner-install">
      <DownloadIcon width={15} height={15} />
      <span style={{ flex: 1 }}>Install Vetro on this device for one-tap access.</span>
      <button type="button" className="btn btn-secondary" onClick={onInstall} style={{ padding: "4px 10px" }}>
        Install
      </button>
      <button type="button" onClick={onDismiss} aria-label="Dismiss" className="portal-status-banner-dismiss">
        <XIcon width={14} height={14} />
      </button>
    </div>
  );
}

export function PortalLayout() {
  const { isAuthenticated, isLoading, logout, role } = useAuth();
  const api = useApi();
  const tenant = useTenantSlug();
  const location = useLocation();
  const isOnline = useOnlineStatus();
  const { canInstall, promptInstall, dismiss } = useInstallPrompt();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [officer, setOfficer] = useState<Officer | undefined>(undefined);
  const [isLoadingOfficer, setIsLoadingOfficer] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    void api
      .getMyOfficer()
      .then(setOfficer)
      .finally(() => setIsLoadingOfficer(false));
  }, []);

  useEffect(() => {
    function pollUnread() {
      void api.getMyUnreadMessageCount().then(({ unreadCount: count }) => setUnreadCount(count));
    }
    pollUnread();
    const interval = setInterval(pollUnread, MESSAGE_POLL_MS);
    // MyMessages.tsx fires this the moment it marks everything read, so the
    // badge doesn't sit stale for up to a full poll interval after an
    // officer actually clears their messages.
    window.addEventListener(MESSAGES_READ_EVENT, pollUnread);
    return () => {
      clearInterval(interval);
      window.removeEventListener(MESSAGES_READ_EVENT, pollUnread);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <>
      {!isOnline && <OfflineBanner />}
      {isOnline && canInstall && <InstallBanner onInstall={promptInstall} onDismiss={dismiss} />}
      <div className="app-shell has-tab-bar">
        {mobileNavOpen && <div className="app-sidebar-scrim" onClick={() => setMobileNavOpen(false)} />}
      <aside className={`app-sidebar${mobileNavOpen ? " open" : ""}`}>
        <img src="/brand/vetro-logo-horizontal.svg" alt="Vetro" height="40" className="sidebar-logo" />
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
          <NavLink to={`/${tenant}/portal/messages`}>
            <MessageIcon />
            Messages
            {unreadCount > 0 && <span className="nav-badge">{unreadCount}</span>}
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
        <CheckCallButton />
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
        <button type="button" className="mobile-tab" onClick={() => setMobileNavOpen(true)} style={{ position: "relative" }}>
          <MenuIcon />
          {unreadCount > 0 && <span className="nav-badge nav-badge-corner">{unreadCount}</span>}
          <span>More</span>
        </button>
      </nav>
      </div>
    </>
  );
}
