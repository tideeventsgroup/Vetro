import { useAuth } from "../lib/auth.js";
import { useOrgName } from "../lib/useOrgName.js";

function initial(email: string | undefined): string {
  return email ? email[0]!.toUpperCase() : "?";
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  OFFICER: "Officer",
  CLIENT: "Client contact",
};

// Org + signed-in-account block, anchored to the bottom of every sidebar
// variant (admin dashboard, officer portal, client portal) — the nav
// above it uses flex to push this down, so it always sits directly above
// the sign-out footer regardless of how much nav content there is.
export function SidebarIdentity() {
  const { email, role } = useAuth();
  const orgName = useOrgName();
  const roleLabel = role ? ROLE_LABELS[role] ?? role : undefined;

  return (
    <div className="sidebar-identity">
      {orgName && (
        <div className="sidebar-org">
          <div className="sidebar-org-label">Organisation</div>
          <div className="sidebar-org-name">{orgName}</div>
        </div>
      )}
      <div className="sidebar-user">
        <span className="sidebar-user-avatar">{initial(email)}</span>
        <div className="sidebar-user-info">
          <div className="sidebar-user-email">{email ?? "Signed in"}</div>
          {roleLabel && <span className="sidebar-role-pill">{roleLabel}</span>}
        </div>
      </div>
    </div>
  );
}
