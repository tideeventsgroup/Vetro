import { PrismaClient } from "@prisma/client";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

let clientPromise: Promise<PrismaClient> | undefined;

// Locally, DATABASE_URL is set directly (see .env.example). In AWS, the
// proxy endpoint and secret ARN are wired in by infra/lib/api-stack.ts and
// the password is resolved once per cold start rather than baked into the
// Lambda's plaintext environment.
export async function resolveDatabaseUrl(): Promise<string> {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const secretArn = process.env.DB_SECRET_ARN;
  const proxyEndpoint = process.env.DB_PROXY_ENDPOINT;
  const dbName = process.env.DB_NAME ?? "vetro";
  if (!secretArn || !proxyEndpoint) {
    throw new Error("Set DATABASE_URL, or both DB_SECRET_ARN and DB_PROXY_ENDPOINT");
  }

  const sm = new SecretsManagerClient({});
  const { SecretString } = await sm.send(new GetSecretValueCommand({ SecretId: secretArn }));
  const { username, password } = JSON.parse(SecretString ?? "{}") as {
    username: string;
    password: string;
  };
  return `postgresql://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${proxyEndpoint}:5432/${dbName}?sslmode=require`;
}

/** Reused across warm Lambda invocations — connections are pooled by RDS Proxy either way. */
export async function getDb(): Promise<PrismaClient> {
  if (!clientPromise) {
    clientPromise = resolveDatabaseUrl().then((url) => new PrismaClient({ datasources: { db: { url } } }));
  }
  return clientPromise;
}
