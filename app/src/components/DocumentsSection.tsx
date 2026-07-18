import { ChangeEvent, useState } from "react";
import { OfficerDocument } from "../lib/api.js";
import { DownloadIcon, FileIcon, UploadIcon } from "./icons.js";

export function DocumentsSection({
  documents,
  onUpload,
  onGetDownloadUrl,
  onChange,
}: {
  documents: OfficerDocument[];
  onUpload: (file: File, kind: string) => Promise<OfficerDocument>;
  onGetDownloadUrl: (id: string) => Promise<string>;
  onChange: () => void;
}) {
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
      await onUpload(file, kind);
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
      const url = await onGetDownloadUrl(id);
      window.open(url, "_blank");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not get download link");
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2>Documents</h2>
      </div>

      <div className="form-field" style={{ maxWidth: 280 }}>
        <label htmlFor="documentKind">Kind</label>
        <input id="documentKind" value={kind} onChange={(e) => setKind(e.target.value)} />
      </div>
      <label className="btn btn-secondary" style={{ display: "inline-flex", marginBottom: 16, cursor: "pointer" }}>
        <UploadIcon width={14} height={14} />
        {isUploading ? "Uploading…" : "Upload file"}
        <input type="file" onChange={handleFileChange} disabled={isUploading} style={{ display: "none" }} />
      </label>

      {error && <p className="error-text">{error}</p>}

      {documents.length === 0 ? (
        <div className="empty-state" style={{ padding: "24px 16px" }}>
          <span className="empty-icon" style={{ width: 36, height: 36 }}>
            <FileIcon width={16} height={16} />
          </span>
          <p>No documents on file.</p>
        </div>
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
                    <DownloadIcon width={14} height={14} />
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
