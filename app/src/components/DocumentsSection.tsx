import { ChangeEvent, useState } from "react";
import { OfficerDocument, useApi } from "../lib/api.js";

export function DocumentsSection({
  officerId,
  documents,
  onChange,
}: {
  officerId: string;
  documents: OfficerDocument[];
  onChange: () => void;
}) {
  const api = useApi();
  const [kind, setKind] = useState("SIA licence scan");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(undefined);
    setIsUploading(true);
    try {
      await api.uploadDocument(officerId, file, kind);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDownload(id: string) {
    setError(undefined);
    try {
      const url = await api.getDocumentDownloadUrl(id);
      window.open(url, "_blank");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not get download link");
    }
  }

  return (
    <div className="card">
      <div className="page-header" style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: 16 }}>Documents</h2>
      </div>

      <div className="form-field" style={{ maxWidth: 280 }}>
        <label htmlFor="documentKind">Kind</label>
        <input id="documentKind" value={kind} onChange={(e) => setKind(e.target.value)} />
      </div>
      <label className="btn btn-secondary" style={{ display: "inline-flex", marginBottom: 16 }}>
        {isUploading ? "Uploading…" : "Upload file"}
        <input type="file" onChange={handleFileChange} disabled={isUploading} style={{ display: "none" }} />
      </label>

      {error && <p className="error-text">{error}</p>}

      {documents.length === 0 ? (
        <p style={{ color: "var(--vetro-text-muted)" }}>No documents on file.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Kind</th>
              <th>Uploaded</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {documents.map((d) => (
              <tr key={d.id}>
                <td>{d.kind}</td>
                <td>{new Date(d.uploadedAt).toLocaleDateString("en-GB")}</td>
                <td>
                  <button className="btn btn-secondary" onClick={() => handleDownload(d.id)}>
                    Download
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
