import { FormEvent, useState } from "react";

export function AddOfficerModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (input: { firstName: string; lastName: string; email?: string }) => Promise<void>;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    setIsSubmitting(true);
    try {
      await onSubmit({ firstName, lastName, email: email || undefined });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add officer");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="card modal-panel" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: 18, marginBottom: 16 }}>Add officer</h2>
        <form onSubmit={handleSubmit}>
          {error && <p className="error-text">{error}</p>}
          <div className="form-field">
            <label htmlFor="firstName">First name</label>
            <input id="firstName" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="lastName">Last name</label>
            <input id="lastName" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="officerEmail">Email (optional)</label>
            <input id="officerEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Adding…" : "Add officer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
