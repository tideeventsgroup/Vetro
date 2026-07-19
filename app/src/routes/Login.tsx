import { CognitoUser } from "amazon-cognito-identity-js";
import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { NewPasswordRequiredError, useAuth } from "../lib/auth.js";
import { useApi } from "../lib/api.js";
import { MapPinIcon, QrCodeIcon, ShieldCheckIcon } from "../components/icons.js";
import { StatusBadge } from "../components/StatusBadge.js";

const FEATURES = [
  { icon: MapPinIcon, text: "GPS-verified clock-in/out — proof of presence for every shift you bill" },
  { icon: QrCodeIcon, text: "QR patrol checkpoints, logged automatically — no paper tour sheets" },
  { icon: ShieldCheckIcon, text: "SIA licence and BS7858 vetting tracked for you — nothing to chase" },
];

// Login itself is tenant-agnostic — there's no /:tenant prefix here (see
// App.tsx), so the destination after signing in is resolved from the
// account itself rather than typed into the URL beforehand: the ID token's
// custom:contractor_id claim already scopes GET /contractors/me server-side
// (see backend/src/lib/auth.ts), so all this needs is the slug that comes
// back to know which tenant-prefixed route to land on.
function destinationFor(role: string | undefined, slug: string): string {
  if (role === "OFFICER") return `/${slug}/portal`;
  if (role === "CLIENT") return `/${slug}/client`;
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

  async function redirectToOwnTenant(role: string | undefined) {
    const contractor = await api.getCurrentContractor();
    if (!contractor) throw new Error("This account isn't attached to an organisation yet");
    navigate(destinationFor(role, contractor.slug), { replace: true });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    setIsSubmitting(true);
    try {
      const claims = await login(email, password);
      await redirectToOwnTenant(claims.role);
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
      const claims = await completeNewPassword(pendingUser, newPassword);
      await redirectToOwnTenant(claims.role);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set new password");
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
          <ul className="login-feature-list">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text}>
                <span className="login-feature-icon">
                  <Icon width={14} height={14} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <div className="login-brand-foot">Built by Tide Events Group Scotland</div>
      </div>

      {/* Mobile/PWA-only — .login-brand-panel above is hidden below 860px,
          so this is what actually greets an officer opening the installed
          app: the desktop version has room for the full pitch, this is
          just the logo + a one-line welcome, anchored above the form. */}
      <div className="login-mobile-brand">
        <img src="/brand/vetro-logo-horizontal-dark.svg" alt="Vetro" height="28" />
        <p>Welcome back — sign in to your officer record.</p>
      </div>

      <div className="login-form-panel">
        <div className="login-card">
          <span className="empty-icon" style={{ background: "var(--vetro-teal-light)", color: "var(--vetro-teal-dark)" }}>
            <ShieldCheckIcon />
          </span>
          {pendingUser ? (
            <>
              <h2>Set a new password</h2>
              <p className="lede">This is a temporary password — choose a permanent one to finish signing in.</p>
              <form onSubmit={handleSetNewPassword}>
                {error && <p className="error-text">{error}</p>}
                <div className="form-field">
                  <label htmlFor="newPassword">New password</label>
                  <input
                    id="newPassword"
                    type="password"
                    required
                    minLength={12}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                <button className="btn btn-primary btn-pill" type="submit" disabled={isSubmitting} style={{ width: "100%", marginTop: 8 }}>
                  {isSubmitting ? "Setting password…" : "Set password and sign in"}
                </button>
              </form>
            </>
          ) : (
            <>
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
                <button className="btn btn-primary btn-pill" type="submit" disabled={isSubmitting} style={{ width: "100%", marginTop: 8 }}>
                  {isSubmitting ? "Signing in…" : "Sign in"}
                </button>
              </form>
            </>
          )}
          {!pendingUser && (
            <p className="subtle-meta" style={{ marginTop: 16 }}>
              New to Vetro? <Link to="/signup">Create an organisation</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
