import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApi } from "../lib/api.js";
import { useAuth } from "../lib/auth.js";
import { EyeIcon, EyeOffIcon, LockIcon, MailIcon } from "../components/icons.js";
import { DashboardColourBadge } from "../components/StatusBadge.js";

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
// via POST /signup/organisation (backend/src/routes/signup.ts), which is
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
  const [showPassword, setShowPassword] = useState(false);

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
      await api.createOrganisationSelfSignup({ name: orgName.trim(), slug });
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
          src="/brand/lunara-logo-primary-dark.svg"
          alt="Lunara Screening"
          height="70"
          style={{ position: "relative" }}
        />
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

      <div className="login-form-panel">
        <div className="login-card">
          {step === "details" ? (
            <>
              <h2>Create your organisation</h2>
              <p className="lede">Set up Lunara Screening for your team in a couple of minutes.</p>
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
                  <label htmlFor="slug">Your Lunara Screening URL</label>
                  <div className="input-addon-field">
                    <span className="input-addon-prefix">{window.location.host}/</span>
                    <input
                      id="slug"
                      required
                      value={slug}
                      onChange={(e) => {
                        setSlugEdited(true);
                        setSlug(slugify(e.target.value));
                      }}
                    />
                  </div>
                </div>
                <div className="form-field">
                  <label htmlFor="signupEmail">Email</label>
                  <div className="input-icon-field">
                    <MailIcon width={16} height={16} />
                    <input
                      id="signupEmail"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="username"
                    />
                  </div>
                </div>
                <div className="form-field">
                  <label htmlFor="signupPassword">Password</label>
                  <div className="input-icon-field has-toggle">
                    <LockIcon width={16} height={16} />
                    <input
                      id="signupPassword"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
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
                  <p style={{ fontSize: 12, color: "var(--lunara-text-muted)", marginTop: 6 }}>
                    At least 12 characters, with upper and lower case, a number, and a symbol.
                  </p>
                </div>
                <button className="btn btn-primary btn-pill" type="submit" disabled={isSubmitting} style={{ width: "100%", marginTop: 8 }}>
                  {isSubmitting ? "Creating…" : "Create organisation"}
                </button>
              </form>
              <p className="subtle-meta" style={{ marginTop: 16 }}>
                Already have an account? <Link to="/login">Sign in</Link>
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
                <button className="btn btn-primary btn-pill" type="submit" disabled={isSubmitting} style={{ width: "100%", marginTop: 8 }}>
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
