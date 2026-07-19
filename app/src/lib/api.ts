import { useAuth } from "./auth.js";
import { getDevOfficerId, getDevRole, getDevSiteId } from "./dev.js";
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

export interface VettingSubmissionForReview extends VettingSubmission {
  officer: { id: string; firstName: string; lastName: string };
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
  licences: SiaLicence[];
  vettingRecords: VettingRecord[];
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

export interface Site {
  id: string;
  contractorId: string;
  name: string;
  address: string | null;
  clientContactName: string | null;
  clientContactEmail: string | null;
  latitude: number | null;
  longitude: number | null;
  geofenceRadiusM: number | null;
  createdAt: string;
}

export type ShiftStatus = "SCHEDULED" | "CONFIRMED" | "COMPLETED" | "MISSED" | "LATE";

export interface Shift {
  id: string;
  contractorId: string;
  siteId: string;
  officerId: string | null;
  startTime: string;
  endTime: string;
  status: ShiftStatus;
  clientConfirmedAt: string | null;
  incidentNotes: string | null;
  clockInAt: string | null;
  clockInLat: number | null;
  clockInLng: number | null;
  clockInAccuracyM: number | null;
  clockInDistanceM: number | null;
  clockOutAt: string | null;
  clockOutLat: number | null;
  clockOutLng: number | null;
  clockOutAccuracyM: number | null;
  clockOutDistanceM: number | null;
  site?: Site;
  officer?: Officer | null;
}

export interface ClockGps {
  lat?: number;
  lng?: number;
  accuracyM?: number;
}

export type IncidentCategory =
  | "THEFT"
  | "VANDALISM"
  | "TRESPASSING"
  | "MEDICAL"
  | "FIRE_SAFETY"
  | "EQUIPMENT_FAULT"
  | "SUSPICIOUS_ACTIVITY"
  | "OTHER";

export interface Incident {
  id: string;
  contractorId: string;
  siteId: string;
  officerId: string;
  category: IncidentCategory;
  description: string;
  occurredAt: string;
  photoKeys: string[];
  latitude: number | null;
  longitude: number | null;
  accuracyM: number | null;
  createdAt: string;
  site?: Site;
  officer?: Officer;
}

export interface Checkpoint {
  id: string;
  contractorId: string;
  siteId: string;
  name: string;
  description: string | null;
  qrCode: string;
  latitude: number | null;
  longitude: number | null;
  geofenceRadiusM: number | null;
  createdAt: string;
  site?: Site;
}

export interface CheckpointScan {
  id: string;
  contractorId: string;
  checkpointId: string;
  officerId: string;
  latitude: number | null;
  longitude: number | null;
  accuracyM: number | null;
  scannedAt: string;
  checkpoint?: Checkpoint;
  officer?: Officer;
}

export interface VisitorLogEntry {
  id: string;
  contractorId: string;
  siteId: string;
  officerId: string;
  visitorName: string;
  company: string | null;
  purpose: string | null;
  hostName: string | null;
  signedInAt: string;
  signedOutAt: string | null;
  site?: Site;
  officer?: Officer;
}

export interface Message {
  id: string;
  contractorId: string;
  senderEmail: string;
  recipientId: string | null;
  body: string;
  createdAt: string;
  recipient?: Officer | null;
}

export interface MyMessage extends Message {
  read: boolean;
}

export interface SiteReport {
  id: string;
  name: string;
  shiftCounts: Record<ShiftStatus, number>;
  officerCount: number;
  officersAtRisk: number;
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
    const devSiteId = getDevSiteId();
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(tenantSlug ? { "X-Vetro-Tenant": tenantSlug } : {}),
        ...(devRole ? { "X-Vetro-Role": devRole } : {}),
        ...(devOfficerId ? { "X-Vetro-Officer-Id": devOfficerId } : {}),
        ...(devSiteId ? { "X-Vetro-Site-Id": devSiteId } : {}),
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
  // submissions — see routes/VettingQueue.tsx and backend/src/routes/vettingSubmissions.ts.
  listVettingSubmissionsForReview(status?: SubmissionStatus): Promise<VettingSubmissionForReview[]> {
    return this.request(`/vetting-submissions${status ? `?status=${status}` : ""}`);
  }

  reviewVettingSubmission(
    id: string,
    input: { status: "APPROVED" | "REJECTED"; reviewNotes?: string; expiryDate?: string }
  ): Promise<VettingSubmission> {
    return this.request(`/vetting-submissions/${id}`, { method: "PATCH", body: JSON.stringify(input) });
  }

  inviteOfficer(
    officerId: string,
    email?: string
  ): Promise<{ status: string; email: string; temporaryPassword: string }> {
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

  listMyShifts(): Promise<Shift[]> {
    return this.request("/me/shifts");
  }

  confirmMyShift(id: string): Promise<Shift> {
    return this.request(`/me/shifts/${id}/confirm`, { method: "PATCH" });
  }

  clockInMyShift(id: string, gps?: ClockGps): Promise<Shift> {
    return this.request(`/me/shifts/${id}/clock-in`, {
      method: "PATCH",
      body: JSON.stringify(gps ?? {}),
    });
  }

  clockOutMyShift(id: string, gps?: ClockGps): Promise<Shift> {
    return this.request(`/me/shifts/${id}/clock-out`, {
      method: "PATCH",
      body: JSON.stringify(gps ?? {}),
    });
  }

  // The sites this officer has ever had a shift at — used to populate
  // site-pickers below without exposing the contractor's full site list to
  // an OFFICER login (see backend/src/routes/me.ts).
  listMySites(): Promise<Site[]> {
    return this.request("/me/sites");
  }

  listMyIncidents(): Promise<Incident[]> {
    return this.request("/me/incidents");
  }

  async uploadMyIncidentPhoto(file: File): Promise<string> {
    const { uploadUrl, s3Key } = await this.request<{ uploadUrl: string; s3Key: string }>(
      "/me/incidents/upload-url",
      { method: "POST", body: JSON.stringify({ fileName: file.name, contentType: file.type || "application/octet-stream" }) }
    );
    const putResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    if (!putResponse.ok) throw new ApiError(putResponse.status, "Upload to storage failed");
    return s3Key;
  }

  reportIncident(input: {
    siteId: string;
    category: IncidentCategory;
    description: string;
    occurredAt: string;
    photoKeys?: string[];
  } & ClockGps): Promise<Incident> {
    return this.request("/me/incidents", { method: "POST", body: JSON.stringify(input) });
  }

  async getMyIncidentPhotoUrl(incidentId: string, key: string): Promise<string> {
    const { downloadUrl } = await this.request<{ downloadUrl: string }>(
      `/me/incidents/${incidentId}/photo-url?key=${encodeURIComponent(key)}`
    );
    return downloadUrl;
  }

  listMyCheckpoints(siteId: string): Promise<{ checkpoints: Checkpoint[]; scans: CheckpointScan[] }> {
    return this.request(`/me/checkpoints?siteId=${encodeURIComponent(siteId)}`);
  }

  scanMyCheckpoint(checkpointId: string, gps?: ClockGps): Promise<CheckpointScan> {
    return this.request(`/me/checkpoints/${checkpointId}/scan`, {
      method: "POST",
      body: JSON.stringify(gps ?? {}),
    });
  }

  scanCheckpointByQrCode(qrCode: string, gps?: ClockGps): Promise<CheckpointScan> {
    return this.request("/me/checkpoints/scan-qr", {
      method: "POST",
      body: JSON.stringify({ qrCode, ...gps }),
    });
  }

  listMyMessages(): Promise<MyMessage[]> {
    return this.request("/me/messages");
  }

  getMyUnreadMessageCount(): Promise<{ unreadCount: number }> {
    return this.request("/me/messages/unread-count");
  }

  markAllMessagesRead(): Promise<{ markedCount: number }> {
    return this.request("/me/messages/mark-read", { method: "POST" });
  }

  listMyVisitorLog(siteId: string): Promise<VisitorLogEntry[]> {
    return this.request(`/me/visitor-log?siteId=${encodeURIComponent(siteId)}`);
  }

  signInVisitor(input: {
    siteId: string;
    visitorName: string;
    company?: string;
    purpose?: string;
    hostName?: string;
  }): Promise<VisitorLogEntry> {
    return this.request("/me/visitor-log", { method: "POST", body: JSON.stringify(input) });
  }

  signOutVisitor(id: string): Promise<VisitorLogEntry> {
    return this.request(`/me/visitor-log/${id}/sign-out`, { method: "PATCH" });
  }

  listSites(): Promise<Site[]> {
    return this.request("/sites");
  }

  getSite(id: string): Promise<Site & { shifts: Shift[] }> {
    return this.request(`/sites/${id}`);
  }

  createSite(input: {
    name: string;
    address?: string;
    clientContactName?: string;
    clientContactEmail?: string;
    latitude?: number;
    longitude?: number;
    geofenceRadiusM?: number;
  }) {
    return this.request<Site>("/sites", { method: "POST", body: JSON.stringify(input) });
  }

  updateSite(
    id: string,
    input: Partial<{
      name: string;
      address: string;
      clientContactName: string;
      clientContactEmail: string;
      latitude: number | null;
      longitude: number | null;
      geofenceRadiusM: number | null;
    }>
  ) {
    return this.request<Site>(`/sites/${id}`, { method: "PATCH", body: JSON.stringify(input) });
  }

  deleteSite(id: string): Promise<void> {
    return this.request(`/sites/${id}`, { method: "DELETE" });
  }

  inviteClient(
    siteId: string,
    email?: string
  ): Promise<{ status: string; email: string; temporaryPassword: string }> {
    return this.request(`/sites/${siteId}/invite-client`, { method: "POST", body: JSON.stringify({ email }) });
  }

  listShifts(filter?: { siteId?: string; from?: string; to?: string }): Promise<Shift[]> {
    const params = new URLSearchParams();
    if (filter?.siteId) params.set("siteId", filter.siteId);
    if (filter?.from) params.set("from", filter.from);
    if (filter?.to) params.set("to", filter.to);
    const qs = params.toString();
    return this.request(`/shifts${qs ? `?${qs}` : ""}`);
  }

  createShift(input: { siteId: string; officerId?: string; startTime: string; endTime: string }) {
    return this.request<Shift>("/shifts", { method: "POST", body: JSON.stringify(input) });
  }

  updateShift(id: string, input: Partial<{ officerId: string | null; startTime: string; endTime: string; status: ShiftStatus }>) {
    return this.request<Shift>(`/shifts/${id}`, { method: "PATCH", body: JSON.stringify(input) });
  }

  deleteShift(id: string): Promise<void> {
    return this.request(`/shifts/${id}`, { method: "DELETE" });
  }

  listSiteReports(range?: { from?: string; to?: string }): Promise<SiteReport[]> {
    const params = new URLSearchParams();
    if (range?.from) params.set("from", range.from);
    if (range?.to) params.set("to", range.to);
    const qs = params.toString();
    return this.request(`/reports/sites${qs ? `?${qs}` : ""}`);
  }

  listIncidents(filter?: { siteId?: string; category?: IncidentCategory; from?: string; to?: string }): Promise<Incident[]> {
    const params = new URLSearchParams();
    if (filter?.siteId) params.set("siteId", filter.siteId);
    if (filter?.category) params.set("category", filter.category);
    if (filter?.from) params.set("from", filter.from);
    if (filter?.to) params.set("to", filter.to);
    const qs = params.toString();
    return this.request(`/incidents${qs ? `?${qs}` : ""}`);
  }

  getIncident(id: string): Promise<Incident> {
    return this.request(`/incidents/${id}`);
  }

  async getIncidentPhotoUrl(incidentId: string, key: string): Promise<string> {
    const { downloadUrl } = await this.request<{ downloadUrl: string }>(
      `/incidents/${incidentId}/photo-url?key=${encodeURIComponent(key)}`
    );
    return downloadUrl;
  }

  listCheckpoints(siteId?: string): Promise<Checkpoint[]> {
    return this.request(`/checkpoints${siteId ? `?siteId=${encodeURIComponent(siteId)}` : ""}`);
  }

  createCheckpoint(input: {
    siteId: string;
    name: string;
    description?: string;
    latitude?: number;
    longitude?: number;
    geofenceRadiusM?: number;
  }): Promise<Checkpoint> {
    return this.request("/checkpoints", { method: "POST", body: JSON.stringify(input) });
  }

  updateCheckpoint(
    id: string,
    input: Partial<{
      name: string;
      description: string;
      latitude: number | null;
      longitude: number | null;
      geofenceRadiusM: number | null;
    }>
  ): Promise<Checkpoint> {
    return this.request(`/checkpoints/${id}`, { method: "PATCH", body: JSON.stringify(input) });
  }

  deleteCheckpoint(id: string): Promise<void> {
    return this.request(`/checkpoints/${id}`, { method: "DELETE" });
  }

  listPatrolLog(filter?: { siteId?: string; from?: string; to?: string }): Promise<CheckpointScan[]> {
    const params = new URLSearchParams();
    if (filter?.siteId) params.set("siteId", filter.siteId);
    if (filter?.from) params.set("from", filter.from);
    if (filter?.to) params.set("to", filter.to);
    const qs = params.toString();
    return this.request(`/patrol-log${qs ? `?${qs}` : ""}`);
  }

  listVisitorLog(filter?: { siteId?: string; from?: string; to?: string }): Promise<VisitorLogEntry[]> {
    const params = new URLSearchParams();
    if (filter?.siteId) params.set("siteId", filter.siteId);
    if (filter?.from) params.set("from", filter.from);
    if (filter?.to) params.set("to", filter.to);
    const qs = params.toString();
    return this.request(`/visitor-log${qs ? `?${qs}` : ""}`);
  }

  listMessages(): Promise<Message[]> {
    return this.request("/messages");
  }

  sendMessage(input: { recipientId?: string; body: string }): Promise<Message> {
    return this.request("/messages", { method: "POST", body: JSON.stringify(input) });
  }

  // Client self-service portal — scoped server-side to the caller's own
  // siteId claim, never to an :id in the URL (see backend/src/routes/client.ts).
  getClientSite(): Promise<Site> {
    return this.request("/client/site");
  }

  listClientShifts(): Promise<Shift[]> {
    return this.request("/client/shifts");
  }

  confirmClientShift(id: string, input: { status: "COMPLETED" | "MISSED" | "LATE"; incidentNotes?: string }) {
    return this.request<Shift>(`/client/shifts/${id}/confirm`, { method: "PATCH", body: JSON.stringify(input) });
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
  const { getIdToken } = useAuth();
  return new VetroApiClient(getIdToken);
}
