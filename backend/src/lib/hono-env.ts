export type AppEnv = {
  Variables: {
    actorEmail: string;
    /**
     * The token's `cognito:username` claim — the pool's actual canonical
     * identifier, distinct from email. Self-serve signups (see
     * routes/signup.ts) get an auto-generated username, not their email, and
     * email-alias lookups against a just-created account can transiently
     * 404 before Cognito's alias index catches up — so any Admin* Cognito
     * call scoped to "this account" uses this, never actorEmail.
     */
    cognitoUsername: string;
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
