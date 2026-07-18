import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApi } from "../lib/api.js";
import { useAuth } from "../lib/auth.js";
import { ShieldCheckIcon } from "../components/icons.js";
import { StatusBadge } from "../components/StatusBadge.js";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type Step = "details" | "verify";

// Self-serve org creation: Cognito account first (email + password only —
// see infra/lib/auth-stack.ts's writeAttributes note on why nothing else
// can be set here), then a confirmation code, then the organisation itself
// via POST /signup/organization (backend/src/routes/signup.ts), which is
// the only thing that ever grants this account ADMIN of anything.
export function Signup() {
  const { signUp, confirmSignUp, login, refreshClaims } = useAuth();
  const api = useApi();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("details");
  const [orgName, setOrgName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleOrgNameChange(value: string) {
    setOrgName(value);
    if (!slugEdited) setSlug(slugify(value));
  }

  async function handleDetailsSubmit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    setIsSubmitting(true);
    try {
      await signUp(email, password);
      setStep("verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create your account");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifySubmit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    setIsSubmitting(true);
    try {
      await confirmSignUp(email, code);
      await login(email, password);
      await api.createOrganizationSelfSignup({ name: orgName.trim(), slug });
      // The token from `login` was minted before the org grant above — pull
      // a fresh one so custom:contractor_id/custom:role are actually on it.
      await refreshClaims();
      navigate(`/${slug}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify your account");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-brand-panel">
        <img
          src="/brand/vetro-logo-primary-dark.svg"
          alt="Vetro — Verified, not assumed."
          height="70"
          style={{ position: "relative" }}
        />
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

          {step === "details" ? (
            <>
              <h2>Create your organisation</h2>
              <p className="lede">Set up Vetro for your team in a couple of minutes.</p>
              <form onSubmit={handleDetailsSubmit}>
                {error && <p className="error-text">{error}</p>}
                <div className="form-field">
                  <label htmlFor="orgName">Organisation name</label>
                  <input
                    id="orgName"
                    required
                    value={orgName}
                    onChange={(e) => handleOrgNameChange(e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="slug">Your Vetro URL</label>
                  <input
                    id="slug"
                    required
                    value={slug}
                    onChange={(e) => {
                      setSlugEdited(true);
                      setSlug(slugify(e.target.value));
                    }}
                  />
                  <p className="subtle-meta">
                    {window.location.origin}/{slug || "your-org"}
                  </p>
                </div>
                <div className="form-field">
                  <label htmlFor="signupEmail">Email</label>
                  <input
                    id="signupEmail"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="username"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="signupPassword">Password</label>
                  <input
                    id="signupPassword"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                  <p className="subtle-meta">At least 12 characters, with upper and lower case, a number, and a symbol.</p>
                </div>
                <button className="btn btn-primary" type="submit" disabled={isSubmitting} style={{ width: "100%", marginTop: 8 }}>
                  {isSubmitting ? "Creating…" : "Create organisation"}
                </button>
              </form>
              <p className="subtle-meta" style={{ marginTop: 16 }}>
                Already have an account? <Link to="/">Sign in</Link>
              </p>
            </>
          ) : (
            <>
              <h2>Check your email</h2>
              <p className="lede">Enter the code we sent to {email}.</p>
              <form onSubmit={handleVerifySubmit}>
                {error && <p className="error-text">{error}</p>}
                <div className="form-field">
                  <label htmlFor="code">Verification code</label>
                  <input
                    id="code"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    autoComplete="one-time-code"
                  />
                </div>
                <button className="btn btn-primary" type="submit" disabled={isSubmitting} style={{ width: "100%", marginTop: 8 }}>
                  {isSubmitting ? "Verifying…" : "Verify & continue"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
