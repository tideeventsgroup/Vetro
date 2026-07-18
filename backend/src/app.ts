import { Hono } from "hono";
import { cors } from "hono/cors";
import { contractors } from "./routes/contractors.js";
import { officers } from "./routes/officers.js";
import { licences } from "./routes/licences.js";
import { vetting } from "./routes/vetting.js";
import { qualifications } from "./routes/qualifications.js";
import { documents } from "./routes/documents.js";
import { dashboard } from "./routes/dashboard.js";
import { exports_ } from "./routes/exports.js";
import { requireAuth, requireContractor } from "./lib/auth.js";
import type { AppEnv } from "./lib/hono-env.js";

export const app = new Hono<AppEnv>();

// Also handled by API Gateway's own CORS config once deployed (see
// infra/lib/api-stack.ts) — needed here too since local dev talks to this
// server directly, with no API Gateway in front of it.
app.use("/*", cors({ origin: "*", allowHeaders: ["Authorization", "Content-Type", "X-Vetro-Tenant"] }));

app.get("/health", (c) => c.json({ status: "ok" }));

// Verifies identity for everything below, but doesn't require a resolved
// tenant yet — /contractors/me and /contractors (dev-only creation) need to
// work for an account that doesn't have one assigned.
const api = new Hono<AppEnv>();
api.use("/*", requireAuth);
api.route("/contractors", contractors);

// Everything else is tenant data and 403s without a resolved contractorId.
const tenantScoped = new Hono<AppEnv>();
tenantScoped.use("/*", requireContractor);
tenantScoped.route("/officers", officers);
tenantScoped.route("/", licences);
tenantScoped.route("/", vetting);
tenantScoped.route("/", qualifications);
tenantScoped.route("/", documents);
tenantScoped.route("/dashboard", dashboard);
tenantScoped.route("/exports", exports_);
api.route("/", tenantScoped);

app.route("/", api);
