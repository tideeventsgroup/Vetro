import { useAuth } from "./auth.js";
import { getDevRole } from "./dev.js";
import { getTenantSlug } from "./tenant.js";

const API_URL = import.meta.env.VITE_API_URL;

export type CheckType = "SIA_LICENCE" | "FIRST_AID" | "RIGHT_TO_WORK" | "ID_DOCUMENT" | "TRAINING" | "DBS_CHECK";
export type CheckStatus = "NOT_STARTED" | "PENDING" | "VERIFIED" | "EXPIRED" | "REJECTED";
export type CandidateStatus = "INVITED" | "IN_PROGRESS" | "SUBMITTED" | "ARCHIVED";
export type DataRequestType = "ACCESS" | "DELETE";
export type DataRequestStatus = "PENDING" | "COMPLETED";

export interface Organisation {
  id: string;
  name: string;
  slug: string;
  retentionDays: number;
  createdAt: string;
}

export interface RoleType {
  id: string;
  organisationId: string;
  name: string;
  requiredCheckTypes: CheckType[];
  createdAt: string;
}

export interface CheckDocument {
  id: string;
  checkId: string;
  storagePath: string;
  fileName: string;
  fileType: string | null;
  uploadedAt: string;
}

export interface Check {
  id: string;
  candidateId: string;
  checkType: CheckType;
  status: CheckStatus;
  licenceNumber: string | null;
  expiryDate: string | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
  notes: string | null;
  documents?: CheckDocument[];
  createdAt: string;
  updatedAt: string;
}

export interface Candidate {
  id: string;
  organisationId: string;
  firstName: string;
  lastName: string;
  email: string;
  roleTypeId: string | null;
  roleType?: RoleType | null;
  status: CandidateStatus;
  inviteToken: string;
  invitedByEmail: string;
  checks: Check[];
  createdAt: string;
  updatedAt: string;
}

/** What a candidate sees of themselves through their own magic link (routes/candidatePublic.ts) — the same record, plus which org invited them. */
export interface PublicCandidate extends Candidate {
  organisation: { id: string; name: string };
}

export interface DataRequest {
  id: string;
  candidateId: string | null;
  organisationId: string;
  type: DataRequestType;
  status: DataRequestStatus;
  requestedAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  candidate?: Candidate | null;
}

export interface TeamMember {
  username: string;
  email: string;
  status: string;
  role?: string;
}

export interface AuditLogEntry {
  id: string;
  organisationId: string | null;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: unknown;
  createdAt: string;
}

// The SIA has no public API (see backend/src/routes/candidates.ts) — this is
// the same official lookup form an admin opens by hand to cross-check a
// licence number before confirming an SIA_LICENCE check as VERIFIED.
export const SIA_REGISTER_URL = "https://rolh.services.sia.homeoffice.gov.uk/PublicRegister";

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

class LunaraApiClient {
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
        ...(tenantSlug ? { "X-Lunara-Tenant": tenantSlug } : {}),
        ...(devRole ? { "X-Lunara-Role": devRole } : {}),
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
  async getCurrentOrganisation(): Promise<Organisation | null> {
    return this.request("/organisations/me");
  }

  createOrganisation(name: string): Promise<Organisation> {
    return this.request("/organisations", { method: "POST", body: JSON.stringify({ name }) });
  }

  /** Self-serve signup's org-creation step — see routes/Signup.tsx. */
  createOrganisationSelfSignup(input: { name: string; slug: string }): Promise<Organisation> {
    return this.request("/signup/organisation", { method: "POST", body: JSON.stringify(input) });
  }

  updateOrganisation(input: Partial<{ name: string; retentionDays: number }>): Promise<Organisation> {
    return this.request("/organisations/me", { method: "PATCH", body: JSON.stringify(input) });
  }

  listRoleTypes(): Promise<RoleType[]> {
    return this.request("/role-types");
  }

  createRoleType(input: { name: string; requiredCheckTypes: CheckType[] }): Promise<RoleType> {
    return this.request("/role-types", { method: "POST", body: JSON.stringify(input) });
  }

  updateRoleType(id: string, input: Partial<{ name: string; requiredCheckTypes: CheckType[] }>): Promise<RoleType> {
    return this.request(`/role-types/${id}`, { method: "PATCH", body: JSON.stringify(input) });
  }

  deleteRoleType(id: string): Promise<void> {
    return this.request(`/role-types/${id}`, { method: "DELETE" });
  }

  listCandidates(): Promise<Candidate[]> {
    return this.request("/candidates");
  }

  getCandidate(id: string): Promise<Candidate> {
    return this.request(`/candidates/${id}`);
  }

  inviteCandidate(input: { firstName: string; lastName: string; email: string; roleTypeId?: string }): Promise<Candidate> {
    return this.request("/candidates", { method: "POST", body: JSON.stringify(input) });
  }

  deleteCandidate(id: string): Promise<void> {
    return this.request(`/candidates/${id}`, { method: "DELETE" });
  }

  reviewCheck(
    candidateId: string,
    checkId: string,
    input: Partial<{ status: CheckStatus; notes: string; expiryDate: string | null; licenceNumber: string }>
  ): Promise<Check> {
    return this.request(`/candidates/${candidateId}/checks/${checkId}`, { method: "PATCH", body: JSON.stringify(input) });
  }

  async getCheckDocumentDownloadUrl(candidateId: string, checkId: string, documentId: string): Promise<string> {
    const { downloadUrl } = await this.request<{ downloadUrl: string }>(
      `/candidates/${candidateId}/checks/${checkId}/documents/${documentId}/download-url`
    );
    return downloadUrl;
  }

  inviteTeammate(email: string, role?: "ADMIN" | "REVIEWER"): Promise<{ status: string; email: string; temporaryPassword: string }> {
    return this.request("/invitations", { method: "POST", body: JSON.stringify({ email, role }) });
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

  listDataRequests(): Promise<DataRequest[]> {
    return this.request("/data-requests");
  }

  resolveDataRequest(id: string): Promise<DataRequest> {
    return this.request(`/data-requests/${id}/resolve`, { method: "POST" });
  }

  // The candidate-facing side — no session, no tenant header, just the
  // unguessable inviteToken from their invite email (see
  // backend/src/routes/candidatePublic.ts).
  getPublicCandidate(token: string): Promise<PublicCandidate> {
    return this.request(`/public/candidates/${encodeURIComponent(token)}`);
  }

  async uploadCandidateDocument(
    token: string,
    checkId: string,
    file: File,
    details?: { licenceNumber?: string; expiryDate?: string }
  ): Promise<void> {
    const { uploadUrl, storagePath } = await this.request<{ uploadUrl: string; storagePath: string }>(
      `/public/candidates/${encodeURIComponent(token)}/checks/${checkId}/upload-url`,
      { method: "POST", body: JSON.stringify({ fileName: file.name, contentType: file.type || "application/octet-stream" }) }
    );
    const putResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    if (!putResponse.ok) throw new ApiError(putResponse.status, "Upload to storage failed");
    await this.request(`/public/candidates/${encodeURIComponent(token)}/checks/${checkId}/documents`, {
      method: "POST",
      body: JSON.stringify({
        storagePath,
        fileName: file.name,
        fileType: file.type || undefined,
        ...details,
      }),
    });
  }

  submitCandidate(token: string): Promise<PublicCandidate> {
    return this.request(`/public/candidates/${encodeURIComponent(token)}/submit`, { method: "POST" });
  }

  createCandidateDataRequest(token: string, type: DataRequestType): Promise<DataRequest> {
    return this.request(`/public/candidates/${encodeURIComponent(token)}/data-requests`, {
      method: "POST",
      body: JSON.stringify({ type }),
    });
  }
}

export function useApi(): LunaraApiClient {
  const { getIdToken } = useAuth();
  return new LunaraApiClient(getIdToken);
}
