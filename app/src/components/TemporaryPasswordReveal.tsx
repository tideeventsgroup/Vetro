import { useState } from "react";

// Shown after any invite (teammate/officer/client): Cognito's own email
// delivery is capped at 50/day pool-wide with no way to raise that short of
// moving to SES, so the invited account's temporary password comes back in
// the API response too — this is the fallback hand-off when email doesn't
// arrive, not just a convenience.
export function TemporaryPasswordReveal({ password }: { password: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginTop: 8,
        padding: "8px 12px",
        background: "var(--vetro-bg)",
        border: "1px solid var(--vetro-border)",
        borderRadius: 6,
      }}
    >
      <code style={{ fontSize: 14, letterSpacing: 0.5, flex: 1 }}>{password}</code>
      <button type="button" className="btn btn-secondary" onClick={handleCopy}>
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
