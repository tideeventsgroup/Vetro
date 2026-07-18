import { useAuth } from "./auth.js";
import { getDevOfficerId, getDevRole } from "./dev.js";
import { getTenantSlug } from "./tenant.js";

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

export type SubmissionStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED";

export interface VettingSubmission {
  id: string;
  officerId: string;
  addressHistory: unknown;
  employmentHistory: unknown;
  references: unknown;
  consentGiven: boolean;
  status: SubmissionStatus;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNotes: string | null;
  submittedAt: string;
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
  vettingSubmissions?: VettingSubmission[];
}

export interface Contractor {
  id: string;
  name: string;
  slug: string;
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
    const tenantSlug = getTenantSlug();
    const devRole = getDevRole();
    const devOfficerId = getDevOfficerId();
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(tenantSlug ? { "X-Vetro-Tenant": tenantSlug } : {}),
        ...(devRole ? { "X-Vetro-Role": devRole } : {}),
        ...(devOfficerId ? { "X-Vetro-Officer-Id": devOfficerId } : {}),
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

  /** The tenant for the subdomain this page is running on, or null if none exists yet. */
  async getCurrentContractor(): Promise<Contractor | null> {
    return this.request("/contractors/me");
  }

  createContractor(name: string): Promise<Contractor> {
    return this.request("/contractors", { method: "POST", body: JSON.stringify({ name }) });
  }

  listOfficers(): Promise<Officer[]> {
    return this.request("/officers");
  }

  getOfficer(id: string): Promise<Officer> {
    return this.request(`/officers/${id}`);
  }

  createOfficer(input: { firstName: string; lastName: string; email?: string; phone?: string }) {
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

  getDashboardSummary(): Promise<DashboardSummary> {
    return this.request("/dashboard/summary");
  }

  inviteTeammate(email: string): Promise<{ status: string; email: string }> {
    return this.request("/invitations", { method: "POST", body: JSON.stringify({ email }) });
  }

  inviteOfficer(officerId: string, email?: string): Promise<{ status: string; email: string }> {
    return this.request(`/officers/${officerId}/invite`, { method: "POST", body: JSON.stringify({ email }) });
  }

  // Officer self-service portal — scoped server-side to the caller's own
  // officerId claim, never to an :id in the URL (see backend/src/routes/me.ts).
  getMyOfficer(): Promise<Officer> {
    return this.request("/me/officer");
  }

  listMyVettingSubmissions(): Promise<VettingSubmission[]> {
    return this.request("/me/vetting-submissions");
  }

  submitVetting(input: {
    addressHistory: unknown;
    employmentHistory: unknown;
    references: unknown;
    consentGiven: boolean;
  }): Promise<VettingSubmission> {
    return this.request("/me/vetting-submissions", { method: "POST", body: JSON.stringify(input) });
  }

  async uploadMyDocument(file: File, kind: string): Promise<OfficerDocument> {
    const { uploadUrl, s3Key } = await this.request<{ uploadUrl: string; s3Key: string }>(
      "/me/documents/upload-url",
      { method: "POST", body: JSON.stringify({ fileName: file.name, contentType: file.type || "application/octet-stream" }) }
    );
    const putResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    if (!putResponse.ok) throw new ApiError(putResponse.status, "Upload to storage failed");
    return this.request<OfficerDocument>("/me/documents", { method: "POST", body: JSON.stringify({ kind, s3Key }) });
  }

  async getMyDocumentDownloadUrl(id: string): Promise<string> {
    const { downloadUrl } = await this.request<{ downloadUrl: string }>(`/me/documents/${id}/download-url`);
    return downloadUrl;
  }

  async downloadExport(): Promise<Blob> {
    const token = this.getToken();
    const tenantSlug = getTenantSlug();
    const response = await fetch(`${API_URL}/exports/officers.csv`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(tenantSlug ? { "X-Vetro-Tenant": tenantSlug } : {}),
      },
    });
    if (!response.ok) throw new ApiError(response.status, await response.text());
    return response.blob();
  }
}

export function useApi(): VetroApiClient {
  const { idToken } = useAuth();
  return new VetroApiClient(() => idToken);
}
