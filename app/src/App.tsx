import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./lib/auth.js";
import { Dashboard } from "./routes/Dashboard.js";
import { Login } from "./routes/Login.js";
import { OfficerDetail } from "./routes/OfficerDetail.js";
import { ProtectedLayout } from "./routes/ProtectedLayout.js";

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/officers/:id" element={<OfficerDetail />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
