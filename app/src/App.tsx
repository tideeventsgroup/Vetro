import { BrowserRouter, Route, Routes } from "react-router-dom";
import { SplashScreen } from "./components/SplashScreen.js";
import { AuthProvider } from "./lib/auth.js";
import { AuditLog } from "./routes/AuditLog.js";
import { CandidateVetting } from "./routes/CandidateVetting.js";
import { Login } from "./routes/Login.js";
import { NoTenant } from "./routes/NoTenant.js";
import { OfficerDetail } from "./routes/OfficerDetail.js";
import { PinAccess } from "./routes/PinAccess.js";
import { ProtectedLayout } from "./routes/ProtectedLayout.js";
import { Settings } from "./routes/Settings.js";
import { Signup } from "./routes/Signup.js";
import { Staff } from "./routes/Staff.js";
import { Team } from "./routes/Team.js";
import { Vetting } from "./routes/Vetting.js";

// Everything past sign-in lives under /:tenant — clyde-coast.vetro.co.uk's
// per-org subdomain, once a custom domain exists, becomes .../clyde-coast
// today instead (see lib/tenant.ts). Login itself is the one exception:
// it's a single un-prefixed route (nobody should have to already know their
// org's slug just to sign in) — Login.tsx resolves the right tenant from
// the account itself once authenticated and redirects there. Bare "/" and
// /signup are also tenant-agnostic for the same reason (there's no tenant
// to resolve yet, or the user is picking one). /:tenant/pin-access is public
// (no Cognito account) — an officer's own way into their vetting record via
// their PIN (see routes/pinAccess.ts).
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
          <Route path="/candidate-vetting/:token" element={<CandidateVetting />} />
          <Route path="/:tenant">
            <Route path="pin-access" element={<PinAccess />} />
            <Route element={<ProtectedLayout />}>
              <Route index element={<Vetting />} />
              <Route path="officers/:id" element={<OfficerDetail />} />
              <Route path="vetting" element={<Vetting />} />
              <Route path="staff" element={<Staff />} />
              <Route path="team" element={<Team />} />
              <Route path="settings" element={<Settings />} />
              <Route path="audit-log" element={<AuditLog />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
