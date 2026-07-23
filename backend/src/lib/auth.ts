import { CognitoJwtVerifier } from "aws-jwt-verify";
import type { MiddlewareHandler } from "hono";
import { getDb } from "../db/client.js";
import type { AppEnv } from "./hono-env.js";

let verifier: ReturnType<typeof CognitoJwtVerifier.create> | undefined;

function getVerifier() {
  if (!verifier) {
    verifier = CognitoJwtVerifier.create({
      userPoolId: requireEnv("COGNITO_USER_POOL_ID"),
      // The ID token, not the access token: custom attributes like
      // custom:contractor_id (the org/tenant assignment — the attribute
      // name itself predates this rename and can't change without
      // recreating the Cognito User Pool, so it stays as-is at the wire
      // level even though the app now calls this "organisationId"
      // everywhere) only appear on the ID token by default. Getting them
      // onto the access token instead would need a Pre Token Generation
      // Lambda trigger — more moving parts for no benefit here, since this
      // API is the only thing that ever reads this token.
      tokenUse: "id",
      clientId: requireEnv("COGNITO_CLIENT_ID"),
    });
  }
  return verifier;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

/**
 * Verifies identity and resolves the tenant. Sets `organisationId` in
 * context when a tenant is known — routes that require one enforce that
 * themselves via `requireOrganisation`, so this middleware can also serve
 * requests (like checking/creating a tenant) that run before one exists.
 *
 * The client-sent X-Lunara-Tenant header is only ever trusted in SKIP_AUTH
 * dev mode. In real deployments the tenant comes from the verified token's
 * custom:contractor_id claim — a client cannot pick its own tenant by
 * sending a different header.
 */
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (process.env.SKIP_AUTH === "true") {
    const tenantSlug = c.req.header("X-Lunara-Tenant");
    c.set("actorEmail", "dev@local");
    c.set("cognitoUsername", "dev@local");
    c.set("role", c.req.header("X-Lunara-Role") ?? "ADMIN");
    c.set("isPlatformAdmin", c.req.header("X-Lunara-Platform-Admin") === "true");
    if (tenantSlug) {
      c.set("tenantSlug", tenantSlug);
      const db = await getDb();
      const organisation = await db.organisation.findUnique({ where: { slug: tenantSlug } });
      if (organisation) c.set("organisationId", organisation.id);
    }
    await next();
    return;
  }

  const header = c.req.header("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
  if (!token) {
    return c.json({ error: "Missing bearer token" }, 401);
  }

  try {
    const payload = await getVerifier().verify(token);
    c.set("actorEmail", (payload["email"] as string | undefined) ?? payload.sub);
    c.set("cognitoUsername", (payload["cognito:username"] as string | undefined) ?? payload.sub);
    const organisationId = payload["custom:contractor_id"] as string | undefined;
    if (organisationId) c.set("organisationId", organisationId);
    const role = payload["custom:role"] as string | undefined;
    if (role) c.set("role", role);
    const groups = (payload["cognito:groups"] as string[] | undefined) ?? [];
    c.set("isPlatformAdmin", groups.includes("PlatformAdmins"));
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  await next();
};

/** Guards routes that need a resolved tenant — mount below requireAuth. */
export const requireOrganisation: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get("organisationId")) {
    return c.json({ error: "No organisation resolved for this account" }, 403);
  }
  await next();
};

/** Guards routes that only an org's own ADMIN accounts may use (team/settings/role types) — mount below requireAuth. */
export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.get("role") !== "ADMIN") {
    return c.json({ error: "Admin access required" }, 403);
  }
  await next();
};

/** Guards routes either an ADMIN or a REVIEWER may use (candidates, checks, review queue) — mount below requireAuth. */
export const requireReviewer: MiddlewareHandler<AppEnv> = async (c, next) => {
  const role = c.get("role");
  if (role !== "ADMIN" && role !== "REVIEWER") {
    return c.json({ error: "Admin or reviewer access required" }, 403);
  }
  await next();
};

/** Guards platform-level routes (e.g. creating organisations) — mount below requireAuth. */
export const requirePlatformAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get("isPlatformAdmin")) {
    return c.json({ error: "Platform admin access required" }, 403);
  }
  await next();
};
