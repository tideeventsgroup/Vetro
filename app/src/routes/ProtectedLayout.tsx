import { Navigate, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth.js";

export function ProtectedLayout() {
  const { isAuthenticated, isLoading, logout } = useAuth();

  if (isLoading) return <p style={{ padding: 24 }}>Loading…</p>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="vetro-wordmark">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 4L12 20L20 4" stroke="#0E7C7B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          VETRO
        </div>
        <nav className="app-nav">
          <NavLink to="/" end>
            Roster
          </NavLink>
          <a href="#" onClick={logout}>
            Sign out
          </a>
        </nav>
      </aside>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
