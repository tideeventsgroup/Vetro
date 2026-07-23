import { BrowserRouter, Route, Routes } from "react-router-dom";
import { SplashScreen } from "./components/SplashScreen.js";
import { AuthProvider } from "./lib/auth.js";
import { AuditLog } from "./routes/AuditLog.js";
import { CandidateDetail } from "./routes/CandidateDetail.js";
import { CandidateSelfService } from "./routes/CandidateSelfService.js";
import { ComplianceReport } from "./routes/ComplianceReport.js";
import { Dashboard } from "./routes/Dashboard.js";
import { DataRequests } from "./routes/DataRequests.js";
import { Login } from "./routes/Login.js";
import { NoTenant } from "./routes/NoTenant.js";
import { ProtectedLayout } from "./routes/ProtectedLayout.js";
import { RoleTypes } from "./routes/RoleTypes.js";
import { Settings } from "./routes/Settings.js";
import { Signup } from "./routes/Signup.js";
import { Team } from "./routes/Team.js";

// Everything past sign-in lives under /:tenant — an org's per-org subdomain,
// once a custom domain exists, becomes .../their-org today instead (see
// lib/tenant.ts). Login itself is the one exception: it's a single
// un-prefixed route (nobody should have to already know their org's slug
// just to sign in) — Login.tsx resolves the right tenant from the account
// itself once authenticated and redirects there. Bare "/" and /signup are
// also tenant-agnostic for the same reason. /candidates/:token is fully
// public — no Cognito account, no tenant prefix — a candidate's inviteToken
// (see routes/candidatePublic.ts on the backend) is the only thing standing
// in for their own access.
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
          <Route path="/candidates/:token" element={<CandidateSelfService />} />
          <Route path="/:tenant">
            <Route path="report" element={<ComplianceReport />} />
            <Route path="candidates/:id/report" element={<ComplianceReport />} />
            <Route element={<ProtectedLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="candidates/:id" element={<CandidateDetail />} />
              <Route path="role-types" element={<RoleTypes />} />
              <Route path="team" element={<Team />} />
              <Route path="settings" element={<Settings />} />
              <Route path="audit-log" element={<AuditLog />} />
              <Route path="data-requests" element={<DataRequests />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
