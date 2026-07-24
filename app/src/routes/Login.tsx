import { CognitoUser } from "amazon-cognito-identity-js";
import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { NewPasswordRequiredError, useAuth } from "../lib/auth.js";
import { useApi } from "../lib/api.js";
import { EyeIcon, EyeOffIcon, LockIcon, MailIcon } from "../components/icons.js";
import { DashboardColourBadge } from "../components/StatusBadge.js";

// Login itself is tenant-agnostic — there's no /:tenant prefix here (see
// App.tsx), so the destination after signing in is resolved from the
// account itself rather than typed into the URL beforehand: the ID token's
// custom:contractor_id claim already scopes GET /organisations/me
// server-side (see backend/src/lib/auth.ts), so all this needs is the slug
// that comes back to know which tenant-prefixed route to land on.
function destinationFor(slug: string): string {
  return `/${slug}`;
}

export function Login() {
  const { login, completeNewPassword } = useAuth();
  const api = useApi();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Set once an invited account's first login hits Cognito's
  // NEW_PASSWORD_REQUIRED challenge (see NewPasswordRequiredError) — switches
  // the form below to asking for a permanent password instead of signing in.
  const [pendingUser, setPendingUser] = useState<CognitoUser | undefined>(undefined);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  async function redirectToOwnTenant() {
    const organisation = await api.getCurrentOrganisation();
    if (!organisation) throw new Error("This account isn't attached to an organisation yet");
    navigate(destinationFor(organisation.slug), { replace: true });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    setIsSubmitting(true);
    try {
      await login(email, password);
      await redirectToOwnTenant();
    } catch (err) {
      if (err instanceof NewPasswordRequiredError) {
        setPendingUser(err.user);
      } else {
        setError(err instanceof Error ? err.message : "Sign in failed");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSetNewPassword(e: FormEvent) {
    e.preventDefault();
    if (!pendingUser) return;
    setError(undefined);
    setIsSubmitting(true);
    try {
      await completeNewPassword(pendingUser, newPassword);
      await redirectToOwnTenant();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set new password");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-brand-panel">
        <span className="login-orb login-orb-moon" aria-hidden="true" />
        <span className="login-orb login-orb-glow" aria-hidden="true" />
        <span className="login-star" style={{ top: "18%", left: "62%" }} aria-hidden="true" />
        <span className="login-star" style={{ top: "38%", left: "84%", animationDelay: "1.1s" }} aria-hidden="true" />
        <span className="login-star" style={{ top: "68%", left: "48%", animationDelay: "2.2s" }} aria-hidden="true" />
        <img src="/brand/lunara-logo-primary-dark.svg" alt="Lunara Screening" height="70" style={{ position: "relative" }} />
        <div className="login-brand-copy">
          <h1>Workforce compliance, tracked clearly.</h1>
          <p>
            Invite a candidate, they upload their own documents, you review and export — one clear
            record per person, not a folder of emails.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 24, flexWrap: "wrap" }}>
            <DashboardColourBadge colour="green" />
            <DashboardColourBadge colour="amber" />
            <DashboardColourBadge colour="red" />
          </div>
        </div>
        <p className="login-brand-foot">
          Lunara Screening is not a DBS Registered Body or Umbrella Body. DBS, PVG, and Disclosure
          Scotland checks require an accredited partner.
        </p>
      </div>

      {/* Mobile/PWA-only — .login-brand-panel above is hidden below 860px,
          so this is what actually greets someone opening the installed
          app: the desktop version has room for the full pitch, this is
          just the logo + a one-line welcome, anchored above the form. */}
      <div className="login-mobile-brand">
        <img src="/brand/lunara-logo-horizontal-dark.svg" alt="Lunara Screening" height="28" />
        <p>Welcome back — sign in to your organisation.</p>
      </div>

      <div className="login-form-panel">
        <div className="login-card">
          {pendingUser ? (
            <>
              <h2>Set a new password</h2>
              <p className="lede">This is a temporary password — choose a permanent one to finish signing in.</p>
              <form onSubmit={handleSetNewPassword}>
                {error && <p className="error-text">{error}</p>}
                <div className="form-field">
                  <label htmlFor="newPassword">New password</label>
                  <div className="input-icon-field has-toggle">
                    <LockIcon width={16} height={16} />
                    <input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      required
                      minLength={12}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowNewPassword((v) => !v)}
                      aria-label={showNewPassword ? "Hide password" : "Show password"}
                    >
                      {showNewPassword ? <EyeOffIcon width={16} height={16} /> : <EyeIcon width={16} height={16} />}
                    </button>
                  </div>
                </div>
                <button className="btn btn-primary btn-pill" type="submit" disabled={isSubmitting} style={{ width: "100%", marginTop: 8 }}>
                  {isSubmitting ? "Setting password…" : "Set password and sign in"}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2>Sign in</h2>
              <p className="lede">Sign in to your organisation's account.</p>
              <form onSubmit={handleSubmit}>
                {error && <p className="error-text">{error}</p>}
                <div className="form-field">
                  <label htmlFor="email">Email</label>
                  <div className="input-icon-field">
                    <MailIcon width={16} height={16} />
                    <input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="username"
                    />
                  </div>
                </div>
                <div className="form-field">
                  <label htmlFor="password">Password</label>
                  <div className="input-icon-field has-toggle">
                    <LockIcon width={16} height={16} />
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOffIcon width={16} height={16} /> : <EyeIcon width={16} height={16} />}
                    </button>
                  </div>
                </div>
                <button className="btn btn-primary btn-pill" type="submit" disabled={isSubmitting} style={{ width: "100%", marginTop: 8 }}>
                  {isSubmitting ? "Signing in…" : "Sign in"}
                </button>
              </form>
            </>
          )}
          {!pendingUser && (
            <p className="subtle-meta" style={{ marginTop: 16 }}>
              New to Lunara Screening? <Link to="/signup">Create an organisation</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
