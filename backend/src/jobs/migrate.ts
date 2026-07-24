import { createHash } from "node:crypto";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { resolveDatabaseUrl } from "../db/client.js";

// Runs the same migration.sql files `prisma migrate deploy` would, via a
// plain Postgres client instead of the Prisma CLI. The CLI's migration
// engine is a native binary subject to the same Lambda-vs-local-OS mismatch
// @prisma/client's query engine has (see prisma/schema.prisma's
// binaryTargets and infra/lib/prisma-bundling.ts) — recreating the
// _prisma_migrations bookkeeping by hand here avoids needing that binary on
// Lambda at all, while keeping `prisma migrate deploy` run from a normal
// dev machine still able to recognize these as already applied.
const MIGRATIONS_DIR = path.join(__dirname, "prisma-migrations");

interface MigrationResult {
  name: string;
  applied: boolean;
}

interface MigrateEvent {
  /**
   * Optional, explicit only — this Lambda has no admin UI behind it yet, so
   * bootstrapping a tenant is a manual `aws lambda invoke` with a payload,
   * the same way running the migrations themselves is.
   */
  bootstrapOrganisation?: { name: string; slug: string };
  /**
   * Manual `aws lambda invoke` only — empties every application table
   * (schema and _prisma_migrations history are left alone) so an operator
   * can reset a deployment to a clean slate without re-running the
   * fresh-start migration itself. Cognito users are untouched by this; a
   * stale custom:contractor_id claim on an existing Cognito user will point
   * at an Organisation row that no longer exists after a wipe, so clearing
   * this out is normally paired with deleting the affected Cognito users.
   */
  wipeData?: boolean;
}

const APP_TABLES = [
  "AuditLogEntry",
  "DataRequest",
  "Document",
  "Check",
  "Candidate",
  "RoleType",
  "Organisation",
];

export const handler = async (
  event: MigrateEvent = {}
): Promise<{ statusCode: number; body: string }> => {
  const databaseUrl = await resolveDatabaseUrl();
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  const results: MigrationResult[] = [];
  let organisation: { id: string; slug: string } | undefined;
  let wiped = false;
  let counts: Record<string, number> | undefined;

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id" VARCHAR(36) PRIMARY KEY NOT NULL,
        "checksum" VARCHAR(64) NOT NULL,
        "finished_at" TIMESTAMPTZ,
        "migration_name" VARCHAR(255) NOT NULL,
        "logs" TEXT,
        "rolled_back_at" TIMESTAMPTZ,
        "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "applied_steps_count" INTEGER NOT NULL DEFAULT 0
      );
    `);

    const { rows: applied } = await client.query<{ migration_name: string }>(
      `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`
    );
    const appliedNames = new Set(applied.map((r) => r.migration_name));

    const migrationDirs = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    for (const name of migrationDirs) {
      if (appliedNames.has(name)) {
        results.push({ name, applied: false });
        continue;
      }

      const sql = readFileSync(path.join(MIGRATIONS_DIR, name, "migration.sql"), "utf-8");
      const checksum = createHash("sha256").update(sql).digest("hex");

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO "_prisma_migrations"
             (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
           VALUES ($1, $2, now(), $3, now(), 1)`,
          [randomUUID(), checksum, name]
        );
        await client.query("COMMIT");
        results.push({ name, applied: true });
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }

    if (event.wipeData) {
      const quoted = APP_TABLES.map((t) => `"${t}"`).join(", ");
      await client.query(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE;`);
      wiped = true;
    }

    if (event.bootstrapOrganisation) {
      const { name, slug } = event.bootstrapOrganisation;
      const { rows } = await client.query<{ id: string; slug: string }>(
        `INSERT INTO "Organisation" (id, name, slug, "createdAt")
         VALUES ($1, $2, $3, now())
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
         RETURNING id, slug`,
        [randomUUID(), name, slug]
      );
      organisation = rows[0];
    }

    counts = {};
    for (const table of APP_TABLES) {
      const { rows } = await client.query<{ count: string }>(`SELECT COUNT(*) FROM "${table}"`);
      counts[table] = Number(rows[0].count);
    }
  } finally {
    await client.end();
  }

  const body = JSON.stringify({ migrations: results, organisation, wiped, counts });
  console.log(body);
  return { statusCode: 200, body };
};
