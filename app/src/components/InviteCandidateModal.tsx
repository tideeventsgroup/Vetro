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
  const isDisabled = isSubmitting || !firstName.trim() || !lastName.trim() || !email.trim();

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
      <div className="card modal-panel" onClick={(e) => e.stopPropagation()} style={{ width: 440 }}>
        <h2 style={{ fontSize: 19, marginBottom: 4 }}>Invite candidate</h2>
        <p style={{ fontSize: 13, color: "var(--lunara-text-muted)", marginBottom: 20 }}>
          Send a magic link so they can submit their documents.
        </p>
        <form onSubmit={handleSubmit}>
          {error && <p className="error-text">{error}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <div className="form-field" style={{ flex: 1 }}>
              <label htmlFor="candidateFirstName">First name</label>
              <input id="candidateFirstName" required value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="e.g. Jordan" />
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label htmlFor="candidateLastName">Last name</label>
              <input id="candidateLastName" required value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Blake" />
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="candidateEmail">Email address</label>
            <input
              id="candidateEmail"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jordan@example.com"
            />
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
            <div style={{ fontSize: 11, color: "var(--lunara-silver)", marginTop: 6 }}>
              {selectedRoleType
                ? `Determines which checks ${selectedRoleType.name} candidates are asked to submit: ${selectedRoleType.requiredCheckTypes.map(checkTypeLabel).join(", ")}.`
                : "Determines which checks this candidate is asked to submit."}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} style={{ flex: 1 }}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isDisabled} style={{ flex: 1 }}>
              {isSubmitting ? "Sending…" : "Send invite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
