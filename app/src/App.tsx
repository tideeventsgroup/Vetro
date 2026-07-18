import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./lib/auth.js";
import { Dashboard } from "./routes/Dashboard.js";
import { Login } from "./routes/Login.js";
import { OfficerDetail } from "./routes/OfficerDetail.js";
import { PortalHome } from "./routes/PortalHome.js";
import { PortalLayout } from "./routes/PortalLayout.js";
import { ProtectedLayout } from "./routes/ProtectedLayout.js";
import { Team } from "./routes/Team.js";

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/officers/:id" element={<OfficerDetail />} />
            <Route path="/team" element={<Team />} />
          </Route>
          <Route element={<PortalLayout />}>
            <Route path="/portal" element={<PortalHome />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
