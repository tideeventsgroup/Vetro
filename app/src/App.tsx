import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./lib/auth.js";
import { Dashboard } from "./routes/Dashboard.js";
import { Login } from "./routes/Login.js";
import { NoTenant } from "./routes/NoTenant.js";
import { OfficerDetail } from "./routes/OfficerDetail.js";
import { PortalHome } from "./routes/PortalHome.js";
import { PortalLayout } from "./routes/PortalLayout.js";
import { ProtectedLayout } from "./routes/ProtectedLayout.js";
import { Team } from "./routes/Team.js";

// Every real route lives under /:tenant — clyde-coast.vetro.co.uk's
// per-org subdomain, once a custom domain exists, becomes .../clyde-coast
// today instead (see lib/tenant.ts). Bare "/" has no tenant to resolve.
export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<NoTenant />} />
          <Route path="/:tenant">
            <Route path="login" element={<Login />} />
            <Route element={<ProtectedLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="officers/:id" element={<OfficerDetail />} />
              <Route path="team" element={<Team />} />
            </Route>
            <Route element={<PortalLayout />}>
              <Route path="portal" element={<PortalHome />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
