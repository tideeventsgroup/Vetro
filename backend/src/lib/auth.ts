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
      // custom:contractor_id (the tenant assignment) only appear on the ID
      // token by default. Getting them onto the access token instead would
      // need a Pre Token Generation Lambda trigger — more moving parts for
      // no benefit here, since this API is the only thing that ever reads
      // this token.
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
 * Verifies identity and resolves the tenant. Sets `contractorId` in context
 * when a tenant is known — routes that require one enforce that themselves
 * via `requireContractor`, so this middleware can also serve requests (like
 * checking/creating a tenant) that run before one exists.
 *
 * The client-sent X-Vetro-Tenant header is only ever trusted in SKIP_AUTH
 * dev mode. In real deployments the tenant comes from the verified token's
 * custom:contractor_id claim — a client cannot pick its own tenant by
 * sending a different header.
 */
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (process.env.SKIP_AUTH === "true") {
    const tenantSlug = c.req.header("X-Vetro-Tenant");
    c.set("actorEmail", "dev@local");
    if (tenantSlug) {
      c.set("tenantSlug", tenantSlug);
      const db = await getDb();
      const contractor = await db.contractor.findUnique({ where: { slug: tenantSlug } });
      if (contractor) c.set("contractorId", contractor.id);
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
    const contractorId = payload["custom:contractor_id"] as string | undefined;
    if (contractorId) c.set("contractorId", contractorId);
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  await next();
};

/** Guards routes that need a resolved tenant — mount below requireAuth. */
export const requireContractor: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get("contractorId")) {
    return c.json({ error: "No tenant resolved for this account" }, 403);
  }
  await next();
};
