import { Hono } from "hono";
import { cors } from "hono/cors";
import { admin } from "./routes/admin.js";
import { auditLog } from "./routes/auditLog.js";
import { candidatePublic } from "./routes/candidatePublic.js";
import { candidates } from "./routes/candidates.js";
import { dataRequests } from "./routes/dataRequests.js";
import { invitations } from "./routes/invitations.js";
import { organisations } from "./routes/organisations.js";
import { roleTypes } from "./routes/roleTypes.js";
import { signup } from "./routes/signup.js";
import { team } from "./routes/team.js";
import { requireAdmin, requireAuth, requireOrganisation, requirePlatformAdmin, requireReviewer } from "./lib/auth.js";
import type { AppEnv } from "./lib/hono-env.js";

export const app = new Hono<AppEnv>();

// Also handled by API Gateway's own CORS config once deployed (see
// infra/lib/api-stack.ts) — needed here too since local dev talks to this
// server directly, with no API Gateway in front of it.
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Authorization", "Content-Type", "X-Lunara-Tenant", "X-Lunara-Role", "X-Lunara-Platform-Admin"],
  }),
);

app.get("/health", (c) => c.json({ status: "ok" }));

// Public, no Cognito session at all — a candidate invited via
// routes/candidates.ts has no Cognito account; the magic-link token in the
// URL is what authorises this instead (see routes/candidatePublic.ts).
// Mounted under its own /public/candidates path so it can't collide with
// the admin-only /candidates prefix's requireOrganisation/requireReviewer
// guard below.
app.route("/", candidatePublic);

// Verifies identity for everything below, but doesn't require a resolved
// tenant yet — /organisations/me and /organisations (dev-only creation) need
// to work for an account that doesn't have one assigned.
const api = new Hono<AppEnv>();
api.use("/*", requireAuth);
api.route("/organisations", organisations);
api.route("/", signup);

// Platform-level: creating organisations. No tenant involved — gated purely
// on Cognito PlatformAdmins group membership.
api.use("/admin/*", requirePlatformAdmin);
api.route("/admin", admin);

// Candidates/checks/review-queue are usable by ADMIN or REVIEWER accounts;
// everything else tenant-scoped (role types, team, settings, audit log,
// data requests) stays ADMIN-only. Every top-level path these route modules
// actually define — bare and nested — needs to be listed here.
const reviewerPrefixes = ["/candidates"];
const tenantAdminPrefixes = ["/role-types", "/invitations", "/team", "/audit-log", "/data-requests"];
for (const prefix of reviewerPrefixes) {
  api.use(prefix, requireOrganisation, requireReviewer);
  api.use(`${prefix}/*`, requireOrganisation, requireReviewer);
}
for (const prefix of tenantAdminPrefixes) {
  api.use(prefix, requireOrganisation, requireAdmin);
  api.use(`${prefix}/*`, requireOrganisation, requireAdmin);
}
api.route("/candidates", candidates);
api.route("/", roleTypes);
api.route("/", invitations);
api.route("/", team);
api.route("/", auditLog);
api.route("/", dataRequests);

app.route("/", api);
