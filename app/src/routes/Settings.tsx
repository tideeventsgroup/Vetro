import { FormEvent, useEffect, useState } from "react";
import { SettingsIcon } from "../components/icons.js";
import { Organisation, useApi } from "../lib/api.js";

export function Settings() {
  const api = useApi();
  const [organisation, setOrganisation] = useState<Organisation | undefined>(undefined);
  const [name, setName] = useState("");
  const [retentionDays, setRetentionDays] = useState("365");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setIsLoading(true);
    try {
      const current = await api.getCurrentOrganisation();
      if (current) {
        setOrganisation(current);
        setName(current.name);
        setRetentionDays(String(current.retentionDays));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load organisation");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    setStatus(undefined);
    setIsSaving(true);
    try {
      const updated = await api.updateOrganisation({ name: name.trim(), retentionDays: Number(retentionDays) });
      setOrganisation(updated);
      setStatus("Saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save changes");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) return <p style={{ color: "var(--lunara-text-muted)" }}>Loading…</p>;
  if (!organisation) return null;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p>Your organisation's details and data retention policy.</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 460 }}>
        <span className="empty-icon" style={{ background: "var(--lunara-gold-light)", color: "var(--lunara-gold-dark)" }}>
          <SettingsIcon />
        </span>
        <h2 style={{ fontSize: 18, marginBottom: 16 }}>Organisation</h2>
        <form onSubmit={handleSubmit}>
          {error && <p className="error-text">{error}</p>}
          <div className="form-field">
            <label htmlFor="orgName">Name</label>
            <input id="orgName" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="orgUrl">Lunara Screening URL</label>
            <input id="orgUrl" value={`${window.location.origin}/${organisation.slug}`} disabled />
            <p className="subtle-meta">This is fixed once your organisation is created.</p>
          </div>
          <div className="form-field">
            <label htmlFor="retentionDays">Data retention period (days)</label>
            <input
              id="retentionDays"
              type="number"
              min={1}
              required
              value={retentionDays}
              onChange={(e) => setRetentionDays(e.target.value)}
            />
            <p className="subtle-meta">
              Candidates older than this are flagged in the audit log for retention review — GDPR requires
              data isn't kept indefinitely, so this is checked daily rather than left to memory.
            </p>
          </div>
          <button className="btn btn-primary" type="submit" disabled={isSaving}>
            {isSaving ? "Saving…" : "Save"}
          </button>
        </form>
        {status && <p className="subtle-meta">{status}</p>}
      </div>
    </div>
  );
}
