/**
 * SKIP_AUTH-only stand-in for what a real Cognito ID token's custom:role
 * claim would carry (see lib/auth.tsx). Ignored outside SKIP_AUTH mode.
 */
export function getDevRole(): string | undefined {
  return import.meta.env.VITE_DEV_ROLE || undefined;
}
