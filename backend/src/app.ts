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
import { requireAuth } from "./lib/auth.js";
import type { AppEnv } from "./lib/hono-env.js";

export const app = new Hono<AppEnv>();

// Also handled by API Gateway's own CORS config once deployed (see
// infra/lib/api-stack.ts) — needed here too since local dev talks to this
// server directly, with no API Gateway in front of it.
app.use("/*", cors({ origin: "*", allowHeaders: ["Authorization", "Content-Type"] }));

app.get("/health", (c) => c.json({ status: "ok" }));

const api = new Hono<AppEnv>();
api.use("/*", requireAuth);
api.route("/contractors", contractors);
api.route("/officers", officers);
api.route("/", licences);
api.route("/", vetting);
api.route("/", qualifications);
api.route("/", documents);
api.route("/dashboard", dashboard);
api.route("/exports", exports_);

app.route("/", api);
