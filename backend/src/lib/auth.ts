import { CognitoJwtVerifier } from "aws-jwt-verify";
import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "./hono-env.js";

let verifier: ReturnType<typeof CognitoJwtVerifier.create> | undefined;

function getVerifier() {
  if (!verifier) {
    verifier = CognitoJwtVerifier.create({
      userPoolId: requireEnv("COGNITO_USER_POOL_ID"),
      tokenUse: "access",
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

/** Verifies the Cognito access token on every request except health checks. */
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (process.env.SKIP_AUTH === "true") {
    // Local development escape hatch only — never set in deployed environments.
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
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  await next();
};
