import { FormEvent, useEffect, useState } from "react";
import { FileIcon, PlusIcon, TrashIcon } from "../components/icons.js";
import { CheckType, RoleType, useApi } from "../lib/api.js";
import { CHECK_TYPE_LABELS } from "../lib/status.js";

const ALL_CHECK_TYPES = Object.keys(CHECK_TYPE_LABELS) as CheckType[];

export function RoleTypes() {
  const api = useApi();
  const [roleTypes, setRoleTypes] = useState<RoleType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<CheckType>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setIsLoading(true);
    try {
      setRoleTypes(await api.listRoleTypes());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load role types");
    } finally {
      setIsLoading(false);
    }
  }

  function toggle(checkType: CheckType) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(checkType)) next.delete(checkType);
      else next.add(checkType);
      return next;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    setIsSubmitting(true);
    try {
      await api.createRoleType({ name: name.trim(), requiredCheckTypes: Array.from(selected) });
      setName("");
      setSelected(new Set());
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create role type");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(roleType: RoleType) {
    if (!window.confirm(`Delete "${roleType.name}"? Existing candidates keep their checks — this only removes the template.`)) {
      return;
    }
    try {
      await api.deleteRoleType(roleType.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete role type");
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Role types</h1>
          <p>Which checks each kind of role needs — chosen automatically when you invite a candidate.</p>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card" style={{ maxWidth: 460 }}>
        <h2 style={{ fontSize: 18, marginBottom: 16 }}>Add a role type</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="roleTypeName">Name</label>
            <input id="roleTypeName" required placeholder="e.g. Door supervisor" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="form-field">
            <label>Required checks</label>
            {ALL_CHECK_TYPES.map((checkType) => (
              <label key={checkType} className="consent-box" style={{ marginBottom: 4 }}>
                <input type="checkbox" checked={selected.has(checkType)} onChange={() => toggle(checkType)} />
                {CHECK_TYPE_LABELS[checkType]}
              </label>
            ))}
          </div>
          <button className="btn btn-primary" type="submit" disabled={isSubmitting || selected.size === 0}>
            <PlusIcon width={14} height={14} />
            {isSubmitting ? "Adding…" : "Add role type"}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Existing role types</h2>
        </div>
        {isLoading ? (
          <p style={{ color: "var(--lunara-text-muted)" }}>Loading…</p>
        ) : roleTypes.length === 0 ? (
          <div className="empty-state" style={{ padding: "24px 16px" }}>
            <span className="empty-icon" style={{ width: 36, height: 36 }}>
              <FileIcon width={16} height={16} />
            </span>
            <p>No role types yet.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Required checks</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {roleTypes.map((rt) => (
                <tr key={rt.id}>
                  <td>{rt.name}</td>
                  <td>{rt.requiredCheckTypes.map((ct) => CHECK_TYPE_LABELS[ct]).join(", ")}</td>
                  <td>
                    <button className="btn btn-secondary" onClick={() => handleDelete(rt)}>
                      <TrashIcon width={14} height={14} />
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
