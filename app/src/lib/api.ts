import { useAuth } from "./auth.js";
import { getDevRole } from "./dev.js";
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

export type DbsLevel = "BASIC" | "STANDARD" | "ENHANCED";

export interface DbsCheck {
  id: string;
  officerId: string;
  level: DbsLevel;
  certificateNumber: string;
  issueDate: string;
  expiryDate: string | null;
  status: ComplianceStatus;
  lastCheckedAt: string | null;
}

export type ReferenceCheckStatus = "PENDING" | "RECEIVED" | "UNABLE_TO_CONTACT" | "FLAGGED";

export interface ReferenceCheck {
  id: string;
  officerId: string;
  refereeName: string;
  contact: string;
  relationship: string | null;
  requestedAt: string;
  respondedAt: string | null;
  status: ReferenceCheckStatus;
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

export interface VettingSubmissionForReview extends VettingSubmission {
  officer: { id: string; firstName: string; lastName: string };
}

export type VettingInviteStatus = "PENDING" | "SUBMITTED" | "CONVERTED";

export interface VettingInviteDocument {
  id: string;
  kind: string;
  fileName: string;
}

// BS7858/BPSS gap-check findings — see backend/src/lib/vettingCompliance.ts
// for the actual standard requirements these encode.
export interface GapFinding {
  standard: "BS7858" | "BPSS";
  severity: "warning" | "critical";
  message: string;
}

export interface VettingInvite {
  id: string;
  contractorId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  token: string;
  status: VettingInviteStatus;
  requiresDbs: boolean;
  requiresRightToWork: boolean;
  addressHistory: unknown;
  employmentHistory: unknown;
  references: unknown;
  dbsLevel: DbsLevel | null;
  dbsCertificateNumber: string | null;
  dbsIssueDate: string | null;
  rightToWorkConfirmed: boolean;
  rightToWorkDocumentType: string | null;
  rightToWorkExpiryDate: string | null;
  consentGiven: boolean;
  submittedAt: string | null;
  convertedOfficerId: string | null;
  invitedByEmail: string;
  documents: VettingInviteDocument[];
  createdAt: string;
}

export interface PublicVettingInvite {
  firstName: string;
  lastName: string;
  organisationName: string;
  status: VettingInviteStatus;
  requiresDbs: boolean;
  requiresRightToWork: boolean;
  documents: VettingInviteDocument[];
}

export interface TeamMember {
  username: string;
  email: string;
  status: string;
  role?: string;
}

export interface AuditLogEntry {
  id: string;
  contractorId: string | null;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: unknown;
  createdAt: string;
}

export type EmploymentType = "FULL_TIME" | "PART_TIME" | "CASUAL" | "ZERO_HOURS";
export type EmploymentStatus = "ACTIVE" | "ON_LEAVE" | "SUSPENDED" | "LEFT";
export type PayRateType = "HOURLY" | "DAILY" | "SALARY";

export interface Officer {
  id: string;
  contractorId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  nationalInsuranceNumber: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postcode: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelationship: string | null;
  employeeNumber: string | null;
  jobTitle: string | null;
  employmentType: EmploymentType | null;
  employmentStatus: EmploymentStatus;
  startDate: string | null;
  leaveDate: string | null;
  payRate: number | null;
  payRateType: PayRateType | null;
  rightToWorkConfirmed: boolean;
  rightToWorkCheckedAt: string | null;
  rightToWorkExpiryDate: string | null;
  rightToWorkDocumentType: string | null;
  // Pin-access identity — see lib/identityCodes.ts on the backend. Auto-set
  // the moment the officer is added; regenerable from OfficerDetail.tsx.
  pin: string | null;
  licences: SiaLicence[];
  vettingRecords: VettingRecord[];
  dbsChecks: DbsCheck[];
  referenceChecks?: ReferenceCheck[];
  qualifications?: Qualification[];
  documents?: OfficerDocument[];
  vettingSubmissions?: VettingSubmission[];
}

export interface OfficerHrInput {
  email?: string;
  phone?: string;
  dateOfBirth?: string | null;
  nationalInsuranceNumber?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  postcode?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelationship?: string | null;
  employeeNumber?: string | null;
  jobTitle?: string | null;
  employmentType?: EmploymentType | null;
  employmentStatus?: EmploymentStatus;
  startDate?: string | null;
  leaveDate?: string | null;
  payRate?: number | null;
  payRateType?: PayRateType | null;
  rightToWorkConfirmed?: boolean;
  rightToWorkCheckedAt?: string | null;
  rightToWorkExpiryDate?: string | null;
  rightToWorkDocumentType?: string | null;
}

export interface Contractor {
  id: string;
  name: string;
  slug: string;
}

// What the pin-access page (routes/pinAccess.ts) returns once a PIN
// verifies — an officer's own vetting status, no Cognito account involved.
export interface PinAccessStatus {
  organisationName: string;
  firstName: string;
  lastName: string;
  vettingRecords: VettingRecord[];
  dbsChecks: DbsCheck[];
  rightToWorkConfirmed: boolean;
  rightToWorkExpiryDate: string | null;
  vettingSubmissions: VettingSubmission[];
  documents: { id: string; kind: string; uploadedAt: string }[];
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
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(tenantSlug ? { "X-Vetro-Tenant": tenantSlug } : {}),
        ...(devRole ? { "X-Vetro-Role": devRole } : {}),
        ...init?.headers,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      let message = body || response.statusText;
      try {
        const parsed = JSON.parse(body) as { error?: string };
        if (parsed.error) message = parsed.error;
      } catch {
        // Not JSON — fall back to the raw body/status text above.
      }
      throw new ApiError(response.status, message);
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

  /** Self-serve signup's org-creation step — see routes/Signup.tsx. */
  createOrganizationSelfSignup(input: { name: string; slug: string }): Promise<Contractor> {
    return this.request("/signup/organization", { method: "POST", body: JSON.stringify(input) });
  }

  renameOrganization(name: string): Promise<Contractor> {
    return this.request("/contractors/me", { method: "PATCH", body: JSON.stringify({ name }) });
  }

  listOfficers(): Promise<Officer[]> {
    return this.request("/officers");
  }

  getOfficer(id: string): Promise<Officer> {
    return this.request(`/officers/${id}`);
  }

  createOfficer(input: { firstName: string; lastName: string } & OfficerHrInput) {
    return this.request<Officer>("/officers", { method: "POST", body: JSON.stringify(input) });
  }

  updateOfficer(id: string, input: Partial<{ firstName: string; lastName: string }> & OfficerHrInput) {
    return this.request<Officer>(`/officers/${id}`, { method: "PATCH", body: JSON.stringify(input) });
  }

  regenerateOfficerPin(id: string): Promise<{ pin: string }> {
    return this.request(`/officers/${id}/pin`, { method: "POST" });
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

  createDbsCheck(
    officerId: string,
    input: { level: DbsLevel; certificateNumber: string; issueDate: string; expiryDate?: string }
  ) {
    return this.request<DbsCheck>(`/officers/${officerId}/dbs`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  updateDbsCheck(id: string, input: Partial<{ certificateNumber: string; expiryDate: string }>) {
    return this.request<DbsCheck>(`/dbs/${id}`, { method: "PATCH", body: JSON.stringify(input) });
  }

  createReferenceCheck(officerId: string, input: { refereeName: string; contact: string; relationship?: string }) {
    return this.request<ReferenceCheck>(`/officers/${officerId}/reference-checks`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  updateReferenceCheck(id: string, input: Partial<{ status: ReferenceCheckStatus; notes: string }>) {
    return this.request<ReferenceCheck>(`/reference-checks/${id}`, { method: "PATCH", body: JSON.stringify(input) });
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

  inviteTeammate(email: string): Promise<{ status: string; email: string; temporaryPassword: string }> {
    return this.request("/invitations", { method: "POST", body: JSON.stringify({ email }) });
  }

  listTeam(): Promise<TeamMember[]> {
    return this.request("/team");
  }

  removeTeammate(username: string): Promise<void> {
    return this.request(`/team/${encodeURIComponent(username)}`, { method: "DELETE" });
  }

  listAuditLog(): Promise<AuditLogEntry[]> {
    return this.request("/audit-log");
  }

  // The admin-facing review queue for officer self-service vetting
  // submissions — see routes/Vetting.tsx and backend/src/routes/vettingSubmissions.ts.
  listVettingSubmissionsForReview(status?: SubmissionStatus): Promise<VettingSubmissionForReview[]> {
    return this.request(`/vetting-submissions${status ? `?status=${status}` : ""}`);
  }

  reviewVettingSubmission(
    id: string,
    input: { status: "APPROVED" | "REJECTED"; reviewNotes?: string; expiryDate?: string }
  ): Promise<VettingSubmission> {
    return this.request(`/vetting-submissions/${id}`, { method: "PATCH", body: JSON.stringify(input) });
  }

  // Sending a candidate a link before they're added to the roster at all —
  // see routes/Vetting.tsx and backend/src/routes/vettingInvites.ts.
  listVettingInvites(): Promise<VettingInvite[]> {
    return this.request("/vetting-invites");
  }

  createVettingInvite(input: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    requiresDbs?: boolean;
    requiresRightToWork?: boolean;
  }): Promise<VettingInvite> {
    return this.request("/vetting-invites", { method: "POST", body: JSON.stringify(input) });
  }

  revokeVettingInvite(id: string): Promise<void> {
    return this.request(`/vetting-invites/${id}`, { method: "DELETE" });
  }

  convertVettingInvite(id: string): Promise<{ invite: VettingInvite; officer: Officer }> {
    return this.request(`/vetting-invites/${id}/convert`, { method: "POST" });
  }

  async getVettingInviteDocumentDownloadUrl(inviteId: string, documentId: string): Promise<string> {
    const { downloadUrl } = await this.request<{ downloadUrl: string }>(
      `/vetting-invites/${inviteId}/documents/${documentId}/download-url`
    );
    return downloadUrl;
  }

  async getVettingInviteComplianceGaps(inviteId: string): Promise<GapFinding[]> {
    const { findings } = await this.request<{ findings: GapFinding[] }>(`/vetting-invites/${inviteId}/compliance-gaps`);
    return findings;
  }

  async getVettingInviteAiReview(inviteId: string): Promise<string> {
    const { review } = await this.request<{ review: string }>(`/vetting-invites/${inviteId}/compliance-gaps/ai-review`, {
      method: "POST",
    });
    return review;
  }

  async getOfficerComplianceGaps(officerId: string): Promise<GapFinding[]> {
    const { findings } = await this.request<{ findings: GapFinding[] }>(`/officers/${officerId}/compliance-gaps`);
    return findings;
  }

  async getOfficerAiReview(officerId: string): Promise<string> {
    const { review } = await this.request<{ review: string }>(`/officers/${officerId}/compliance-gaps/ai-review`, {
      method: "POST",
    });
    return review;
  }

  // The candidate-facing side — no session, no tenant header (see
  // backend/src/routes/vettingInvitePublic.ts). Goes through the same
  // request() as everything else purely for the shared error handling.
  getPublicVettingInvite(token: string): Promise<PublicVettingInvite> {
    return this.request(`/candidate-vetting/${encodeURIComponent(token)}`);
  }

  submitPublicVettingInvite(
    token: string,
    input: {
      addressHistory: unknown;
      employmentHistory: unknown;
      references: unknown;
      consentGiven: boolean;
      dbsLevel?: DbsLevel;
      dbsCertificateNumber?: string;
      dbsIssueDate?: string;
      rightToWorkConfirmed?: boolean;
      rightToWorkDocumentType?: string;
      rightToWorkExpiryDate?: string;
    }
  ): Promise<{ status: VettingInviteStatus }> {
    return this.request(`/candidate-vetting/${encodeURIComponent(token)}/submit`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async uploadCandidateDocument(token: string, file: File, kind: string): Promise<VettingInviteDocument> {
    const { uploadUrl, s3Key } = await this.request<{ uploadUrl: string; s3Key: string }>(
      `/candidate-vetting/${encodeURIComponent(token)}/documents/upload-url`,
      { method: "POST", body: JSON.stringify({ fileName: file.name, contentType: file.type || "application/octet-stream" }) }
    );
    const putResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    if (!putResponse.ok) throw new ApiError(putResponse.status, "Upload to storage failed");
    return this.request<VettingInviteDocument>(`/candidate-vetting/${encodeURIComponent(token)}/documents`, {
      method: "POST",
      body: JSON.stringify({ kind, fileName: file.name, s3Key }),
    });
  }

  deleteCandidateDocument(token: string, documentId: string): Promise<void> {
    return this.request(`/candidate-vetting/${encodeURIComponent(token)}/documents/${documentId}`, {
      method: "DELETE",
    });
  }

  // Pin-access — an officer's own way into their vetting record, no Cognito
  // account needed (see backend/src/routes/pinAccess.ts). The tenant slug
  // comes from the page's own URL (it's always rendered at /:tenant/pin-access).
  verifyPinAccess(pin: string): Promise<PinAccessStatus> {
    return this.request(`/pin-access/${encodeURIComponent(getTenantSlug() ?? "")}/verify`, {
      method: "POST",
      body: JSON.stringify({ pin }),
    });
  }

  submitPinVetting(
    pin: string,
    input: { addressHistory: unknown; employmentHistory: unknown; references: unknown; consentGiven: boolean }
  ): Promise<VettingSubmission> {
    return this.request(`/pin-access/${encodeURIComponent(getTenantSlug() ?? "")}/vetting-submission`, {
      method: "POST",
      body: JSON.stringify({ pin, ...input }),
    });
  }

  async uploadPinDocument(pin: string, file: File, kind: string): Promise<OfficerDocument> {
    const tenantSlug = encodeURIComponent(getTenantSlug() ?? "");
    const { uploadUrl, s3Key } = await this.request<{ uploadUrl: string; s3Key: string }>(
      `/pin-access/${tenantSlug}/documents/upload-url`,
      { method: "POST", body: JSON.stringify({ pin, fileName: file.name, contentType: file.type || "application/octet-stream" }) }
    );
    const putResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    if (!putResponse.ok) throw new ApiError(putResponse.status, "Upload to storage failed");
    return this.request<OfficerDocument>(`/pin-access/${tenantSlug}/documents`, {
      method: "POST",
      body: JSON.stringify({ pin, kind, s3Key }),
    });
  }
}

export function useApi(): VetroApiClient {
  const { getIdToken } = useAuth();
  return new VetroApiClient(getIdToken);
}
