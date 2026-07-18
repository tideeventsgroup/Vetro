import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./lib/auth.js";
import { AuditLog } from "./routes/AuditLog.js";
import { ClientHome } from "./routes/ClientHome.js";
import { ClientLayout } from "./routes/ClientLayout.js";
import { Dashboard } from "./routes/Dashboard.js";
import { Login } from "./routes/Login.js";
import { NoTenant } from "./routes/NoTenant.js";
import { OfficerDetail } from "./routes/OfficerDetail.js";
import { PortalHome } from "./routes/PortalHome.js";
import { PortalLayout } from "./routes/PortalLayout.js";
import { ProtectedLayout } from "./routes/ProtectedLayout.js";
import { Reports } from "./routes/Reports.js";
import { Schedule } from "./routes/Schedule.js";
import { Settings } from "./routes/Settings.js";
import { Signup } from "./routes/Signup.js";
import { Sites } from "./routes/Sites.js";
import { Team } from "./routes/Team.js";
import { VettingQueue } from "./routes/VettingQueue.js";

// Every real route lives under /:tenant — clyde-coast.vetro.co.uk's
// per-org subdomain, once a custom domain exists, becomes .../clyde-coast
// today instead (see lib/tenant.ts). Bare "/" has no tenant to resolve.
// /signup is the one exception — by definition, someone signing up doesn't
// have a tenant slug yet (they're picking one).
export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<NoTenant />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/:tenant">
            <Route path="login" element={<Login />} />
            <Route element={<ProtectedLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="officers/:id" element={<OfficerDetail />} />
              <Route path="vetting-queue" element={<VettingQueue />} />
              <Route path="sites" element={<Sites />} />
              <Route path="schedule" element={<Schedule />} />
              <Route path="reports" element={<Reports />} />
              <Route path="team" element={<Team />} />
              <Route path="settings" element={<Settings />} />
              <Route path="audit-log" element={<AuditLog />} />
            </Route>
            <Route element={<PortalLayout />}>
              <Route path="portal" element={<PortalHome />} />
            </Route>
            <Route element={<ClientLayout />}>
              <Route path="client" element={<ClientHome />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
