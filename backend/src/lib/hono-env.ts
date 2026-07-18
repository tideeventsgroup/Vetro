export type AppEnv = {
  Variables: {
    actorEmail: string;
    /** Resolved tenant. Unset until requireContractor confirms one exists. */
    contractorId?: string;
    /** The X-Vetro-Tenant header value — only meaningful in SKIP_AUTH dev mode. */
    tenantSlug?: string;
    /** "ADMIN" (contractor admin/office manager) or "OFFICER" (self-service portal). */
    role?: string;
    /** Only set for OFFICER accounts — the Officer record this login is scoped to. */
    officerId?: string;
    /** True for accounts in the PlatformAdmins Cognito group — can create organizations. */
    isPlatformAdmin?: boolean;
  };
};
