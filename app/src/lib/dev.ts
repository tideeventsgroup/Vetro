/**
 * SKIP_AUTH-only stand-ins for what a real Cognito ID token's custom:role /
 * custom:officer_id / custom:site_id claims would carry (see lib/auth.tsx).
 * Ignored outside SKIP_AUTH mode. To develop against the officer
 * self-service portal locally, set VITE_DEV_ROLE=OFFICER and
 * VITE_DEV_OFFICER_ID=<an Officer.id> from the seeded data; for the client
 * portal, VITE_DEV_ROLE=CLIENT and VITE_DEV_SITE_ID=<a Site.id>.
 */
export function getDevRole(): string | undefined {
  return import.meta.env.VITE_DEV_ROLE || undefined;
}

export function getDevOfficerId(): string | undefined {
  return import.meta.env.VITE_DEV_OFFICER_ID || undefined;
}

export function getDevSiteId(): string | undefined {
  return import.meta.env.VITE_DEV_SITE_ID || undefined;
}
