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

// Org + signed-in-account block, shown under the (now much bigger) logo in
// every sidebar variant — admin dashboard, officer portal, client portal.
export function SidebarIdentity() {
  const { email, role } = useAuth();
  const orgName = useOrgName();

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
          {role && <div className="sidebar-user-role">{ROLE_LABELS[role] ?? role}</div>}
        </div>
      </div>
    </div>
  );
}
