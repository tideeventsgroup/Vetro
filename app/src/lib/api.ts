import { useAuth } from "./auth.js";

const API_URL = import.meta.env.VITE_API_URL;

export type ComplianceStatus = "ACTIVE" | "EXPIRING" | "EXPIRED";

export interface SiaLicence {
  id: string;
  officerId: string;
  licenceNumber: string;
  sector: string;
  issueDate: string;
  expiryDate: string;
  status: ComplianceStatus;
  lastCheckedAt: string | null;
}

export interface VettingRecord {
  id: string;
  officerId: string;
  standard: string;
  completedDate: string;
  expiryDate: string | null;
  status: ComplianceStatus;
  notes: string | null;
}

export interface Qualification {
  id: string;
  officerId: string;
  name: string;
  issuedBy: string | null;
  issueDate: string | null;
  expiryDate: string | null;
}

export interface OfficerDocument {
  id: string;
  officerId: string;
  kind: string;
  s3Key: string;
  uploadedAt: string;
}

export interface Officer {
  id: string;
  contractorId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  licences: SiaLicence[];
  vettingRecords: VettingRecord[];
  qualifications?: Qualification[];
  documents?: OfficerDocument[];
}

export interface Contractor {
  id: string;
  name: string;
}

export interface DashboardSummary {
  licences: Partial<Record<ComplianceStatus, number>>;
  vetting: Partial<Record<ComplianceStatus, number>>;
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

class VetroApiClient {
  constructor(private getToken: () => string | undefined) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const token = this.getToken();
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new ApiError(response.status, body || response.statusText);
    }

    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  listContractors(): Promise<Contractor[]> {
    return this.request("/contractors");
  }

  createContractor(name: string): Promise<Contractor> {
    return this.request("/contractors", { method: "POST", body: JSON.stringify({ name }) });
  }

  listOfficers(contractorId?: string): Promise<Officer[]> {
    const query = contractorId ? `?contractorId=${encodeURIComponent(contractorId)}` : "";
    return this.request(`/officers${query}`);
  }

  getOfficer(id: string): Promise<Officer> {
    return this.request(`/officers/${id}`);
  }

  createOfficer(input: { contractorId: string; firstName: string; lastName: string; email?: string; phone?: string }) {
    return this.request<Officer>("/officers", { method: "POST", body: JSON.stringify(input) });
  }

  createLicence(
    officerId: string,
    input: { licenceNumber: string; sector: string; issueDate: string; expiryDate: string }
  ) {
    return this.request<SiaLicence>(`/officers/${officerId}/licences`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  createVettingRecord(
    officerId: string,
    input: { standard?: string; completedDate: string; expiryDate?: string; notes?: string }
  ) {
    return this.request<VettingRecord>(`/officers/${officerId}/vetting`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  createQualification(
    officerId: string,
    input: { name: string; issuedBy?: string; issueDate?: string; expiryDate?: string }
  ) {
    return this.request<Qualification>(`/officers/${officerId}/qualifications`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  deleteQualification(id: string): Promise<void> {
    return this.request(`/qualifications/${id}`, { method: "DELETE" });
  }

  requestDocumentUploadUrl(
    officerId: string,
    input: { fileName: string; contentType: string }
  ): Promise<{ uploadUrl: string; s3Key: string }> {
    return this.request(`/officers/${officerId}/documents/upload-url`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  confirmDocumentUpload(officerId: string, input: { kind: string; s3Key: string }) {
    return this.request<OfficerDocument>(`/officers/${officerId}/documents`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async uploadDocument(officerId: string, file: File, kind: string): Promise<OfficerDocument> {
    const { uploadUrl, s3Key } = await this.requestDocumentUploadUrl(officerId, {
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
    });
    const putResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    if (!putResponse.ok) throw new ApiError(putResponse.status, "Upload to storage failed");
    return this.confirmDocumentUpload(officerId, { kind, s3Key });
  }

  async getDocumentDownloadUrl(id: string): Promise<string> {
    const { downloadUrl } = await this.request<{ downloadUrl: string }>(`/documents/${id}/download-url`);
    return downloadUrl;
  }

  deleteDocument(id: string): Promise<void> {
    return this.request(`/documents/${id}`, { method: "DELETE" });
  }

  getDashboardSummary(contractorId?: string): Promise<DashboardSummary> {
    const query = contractorId ? `?contractorId=${encodeURIComponent(contractorId)}` : "";
    return this.request(`/dashboard/summary${query}`);
  }

  exportUrl(contractorId?: string): string {
    const query = contractorId ? `?contractorId=${encodeURIComponent(contractorId)}` : "";
    return `${API_URL}/exports/officers.csv${query}`;
  }

  async downloadExport(contractorId?: string): Promise<Blob> {
    const token = this.getToken();
    const response = await fetch(this.exportUrl(contractorId), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new ApiError(response.status, await response.text());
    return response.blob();
  }
}

export function useApi(): VetroApiClient {
  const { accessToken } = useAuth();
  return new VetroApiClient(() => accessToken);
}
