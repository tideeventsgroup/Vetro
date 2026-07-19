import { BrowserRouter, Route, Routes } from "react-router-dom";
import { SplashScreen } from "./components/SplashScreen.js";
import { AuthProvider } from "./lib/auth.js";
import { Alerts } from "./routes/Alerts.js";
import { Arbitration } from "./routes/Arbitration.js";
import { AuditLog } from "./routes/AuditLog.js";
import { ClientHome } from "./routes/ClientHome.js";
import { ClientLayout } from "./routes/ClientLayout.js";
import { Dashboard } from "./routes/Dashboard.js";
import { Dispatch } from "./routes/Dispatch.js";
import { Incidents } from "./routes/Incidents.js";
import { Kiosk } from "./routes/Kiosk.js";
import { LiveOps } from "./routes/LiveOps.js";
import { Login } from "./routes/Login.js";
import { MyIncidents } from "./routes/MyIncidents.js";
import { MyMessages } from "./routes/MyMessages.js";
import { MyPatrols } from "./routes/MyPatrols.js";
import { MyShifts } from "./routes/MyShifts.js";
import { MyVisitorLog } from "./routes/MyVisitorLog.js";
import { NoTenant } from "./routes/NoTenant.js";
import { Occupancy } from "./routes/Occupancy.js";
import { OfficerDetail } from "./routes/OfficerDetail.js";
import { Patrols } from "./routes/Patrols.js";
import { PortalHome } from "./routes/PortalHome.js";
import { PortalLayout } from "./routes/PortalLayout.js";
import { ProtectedLayout } from "./routes/ProtectedLayout.js";
import { Reports } from "./routes/Reports.js";
import { Schedule } from "./routes/Schedule.js";
import { Settings } from "./routes/Settings.js";
import { Signup } from "./routes/Signup.js";
import { Sites } from "./routes/Sites.js";
import { Staff } from "./routes/Staff.js";
import { Team } from "./routes/Team.js";
import { VettingQueue } from "./routes/VettingQueue.js";
import { VettingWizard } from "./routes/VettingWizard.js";
import { VisitorLog } from "./routes/VisitorLog.js";

// Everything past sign-in lives under /:tenant — clyde-coast.vetro.co.uk's
// per-org subdomain, once a custom domain exists, becomes .../clyde-coast
// today instead (see lib/tenant.ts). Login itself is the one exception:
// it's a single un-prefixed route (nobody should have to already know their
// org's slug just to sign in) — Login.tsx resolves the right tenant from
// the account itself once authenticated and redirects there. Bare "/" and
// /signup are also tenant-agnostic for the same reason (there's no tenant
// to resolve yet, or the user is picking one).
export function App() {
  return (
    <AuthProvider>
      {/* Rendered as a fixed overlay above everything else — the real app
          keeps mounting underneath it the whole time, so the splash costs
          no extra load time, it's purely a launch-moment visual. */}
      <SplashScreen />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<NoTenant />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/kiosk" element={<Kiosk />} />
          <Route path="/:tenant">
            <Route element={<ProtectedLayout />}>
              {/* Live ops is the landing page — an on-site manager opening
                  this wants "what's happening right now", not a compliance
                  report. The old compliance-first home page moves to its
                  own path rather than disappearing. */}
              <Route index element={<LiveOps />} />
              <Route path="compliance" element={<Dashboard />} />
              <Route path="officers/:id" element={<OfficerDetail />} />
              <Route path="vetting-queue" element={<VettingQueue />} />
              <Route path="staff" element={<Staff />} />
              <Route path="sites" element={<Sites />} />
              <Route path="occupancy" element={<Occupancy />} />
              <Route path="schedule" element={<Schedule />} />
              <Route path="arbitration" element={<Arbitration />} />
              <Route path="incidents" element={<Incidents />} />
              <Route path="patrols" element={<Patrols />} />
              <Route path="visitor-log" element={<VisitorLog />} />
              <Route path="dispatch" element={<Dispatch />} />
              <Route path="alerts" element={<Alerts />} />
              <Route path="reports" element={<Reports />} />
              <Route path="team" element={<Team />} />
              <Route path="settings" element={<Settings />} />
              <Route path="audit-log" element={<AuditLog />} />
            </Route>
            <Route path="portal" element={<PortalLayout />}>
              <Route index element={<PortalHome />} />
              <Route path="shifts" element={<MyShifts />} />
              <Route path="incidents" element={<MyIncidents />} />
              <Route path="patrols" element={<MyPatrols />} />
              <Route path="visitor-log" element={<MyVisitorLog />} />
              <Route path="messages" element={<MyMessages />} />
              <Route path="vetting" element={<VettingWizard />} />
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
