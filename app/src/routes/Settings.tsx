import { FormEvent, useEffect, useState } from "react";
import { SettingsIcon } from "../components/icons.js";
import { Contractor, useApi } from "../lib/api.js";

export function Settings() {
  const api = useApi();
  const [contractor, setContractor] = useState<Contractor | undefined>(undefined);
  const [name, setName] = useState("");
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
      const current = await api.getCurrentContractor();
      if (current) {
        setContractor(current);
        setName(current.name);
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
      const updated = await api.renameOrganization(name.trim());
      setContractor(updated);
      setStatus("Saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save changes");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) return <p style={{ color: "var(--vetro-text-muted)" }}>Loading…</p>;
  if (!contractor) return null;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p>Your organisation's details.</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 460 }}>
        <span className="empty-icon" style={{ background: "var(--vetro-teal-light)", color: "var(--vetro-teal-dark)" }}>
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
            <label htmlFor="orgUrl">Vetro URL</label>
            <input id="orgUrl" value={`${window.location.origin}/${contractor.slug}`} disabled />
            <p className="subtle-meta">This is fixed once your organisation is created.</p>
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
