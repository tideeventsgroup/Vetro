import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth.js";
import { ShieldCheckIcon } from "../components/icons.js";
import { StatusBadge } from "../components/StatusBadge.js";

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-brand-panel">
        <img src="/brand/vetro-logo-primary-dark.svg" alt="Vetro — Verified, not assumed." height="70" style={{ position: "relative" }} />
        <div className="login-brand-copy">
          <h1>Scotland's security workforce, verified.</h1>
          <p>
            One record per officer — licence, vetting, qualifications, documents. Checked
            automatically, not chased manually.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 24, flexWrap: "wrap" }}>
            <StatusBadge status="ACTIVE" />
            <StatusBadge status="EXPIRING" />
            <StatusBadge status="EXPIRED" />
          </div>
        </div>
        <div className="login-brand-foot">Built by Tide Events Group Scotland</div>
      </div>

      <div className="login-form-panel">
        <div className="login-card">
          <span className="empty-icon" style={{ background: "var(--vetro-teal-light)", color: "var(--vetro-teal-dark)" }}>
            <ShieldCheckIcon />
          </span>
          <h2>Sign in</h2>
          <p className="lede">Sign in to your officer record.</p>
          <form onSubmit={handleSubmit}>
            {error && <p className="error-text">{error}</p>}
            <div className="form-field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div className="form-field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={isSubmitting} style={{ width: "100%", marginTop: 8 }}>
              {isSubmitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
