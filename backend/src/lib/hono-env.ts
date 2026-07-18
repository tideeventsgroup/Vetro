export type AppEnv = {
  Variables: {
    actorEmail: string;
    /** Resolved tenant. Unset until requireContractor confirms one exists. */
    contractorId?: string;
    /** The X-Vetro-Tenant header value — only meaningful in SKIP_AUTH dev mode. */
    tenantSlug?: string;
  };
};
