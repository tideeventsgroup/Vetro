import { FormEvent, useState } from "react";
import { RoleType } from "../lib/api.js";
import { checkTypeLabel } from "../lib/status.js";

export function InviteCandidateModal({
  roleTypes,
  onClose,
  onSubmit,
}: {
  roleTypes: RoleType[];
  onClose: () => void;
  onSubmit: (input: { firstName: string; lastName: string; email: string; roleTypeId?: string }) => Promise<void>;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [roleTypeId, setRoleTypeId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const selectedRoleType = roleTypes.find((rt) => rt.id === roleTypeId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    setIsSubmitting(true);
    try {
      await onSubmit({ firstName, lastName, email, roleTypeId: roleTypeId || undefined });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not invite candidate");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="card modal-panel" onClick={(e) => e.stopPropagation()} style={{ width: 460 }}>
        <h2 style={{ fontSize: 18, marginBottom: 16 }}>Invite a candidate</h2>
        <form onSubmit={handleSubmit}>
          {error && <p className="error-text">{error}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <div className="form-field" style={{ flex: 1 }}>
              <label htmlFor="candidateFirstName">First name</label>
              <input id="candidateFirstName" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label htmlFor="candidateLastName">Last name</label>
              <input id="candidateLastName" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="candidateEmail">Email</label>
            <input id="candidateEmail" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="candidateRoleType">Role type</label>
            <select id="candidateRoleType" value={roleTypeId} onChange={(e) => setRoleTypeId(e.target.value)}>
              <option value="">No required checks yet</option>
              {roleTypes.map((rt) => (
                <option key={rt.id} value={rt.id}>
                  {rt.name}
                </option>
              ))}
            </select>
            {selectedRoleType && (
              <p className="subtle-meta">
                Required: {selectedRoleType.requiredCheckTypes.map(checkTypeLabel).join(", ")}
              </p>
            )}
          </div>
          <p className="subtle-meta">
            They'll get a magic link by email to upload their own documents — no account needed on their end.
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Inviting…" : "Send invite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
