import { Hono } from "hono";
import { cors } from "hono/cors";
import { admin } from "./routes/admin.js";
import { auditLog } from "./routes/auditLog.js";
import { contractors } from "./routes/contractors.js";
import { invitations } from "./routes/invitations.js";
import { officers } from "./routes/officers.js";
import { signup } from "./routes/signup.js";
import { team } from "./routes/team.js";
import { licences } from "./routes/licences.js";
import { dbs } from "./routes/dbs.js";
import { referenceChecks } from "./routes/referenceChecks.js";
import { vetting } from "./routes/vetting.js";
import { vettingSubmissions } from "./routes/vettingSubmissions.js";
import { vettingInvites } from "./routes/vettingInvites.js";
import { vettingInvitePublic } from "./routes/vettingInvitePublic.js";
import { pinAccess } from "./routes/pinAccess.js";
import { qualifications } from "./routes/qualifications.js";
import { documents } from "./routes/documents.js";
import { requireAdmin, requireAuth, requireContractor, requirePlatformAdmin } from "./lib/auth.js";
import type { AppEnv } from "./lib/hono-env.js";

export const app = new Hono<AppEnv>();

// Also handled by API Gateway's own CORS config once deployed (see
// infra/lib/api-stack.ts) — needed here too since local dev talks to this
// server directly, with no API Gateway in front of it.
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Authorization", "Content-Type", "X-Vetro-Tenant", "X-Vetro-Role", "X-Vetro-Platform-Admin"],
  }),
);

app.get("/health", (c) => c.json({ status: "ok" }));

// Public, no Cognito session at all — a candidate invited via
// routes/vettingInvites.ts has no Cognito account yet — the token in the
// URL is what authorises this, not a session. Mounted under its own path
// (not /vetting-invites) so it can't collide with that admin-only prefix's
// requireContractor/requireAdmin guard below.
app.route("/", vettingInvitePublic);

// Public in the same sense: an officer reaching the pin-access page has no
// Cognito account either — their PIN (scoped to the tenant slug already in
// the page's own URL) is what authorises this instead.
app.route("/", pinAccess);

// Verifies identity for everything below, but doesn't require a resolved
// tenant yet — /contractors/me and /contractors (dev-only creation) need to
// work for an account that doesn't have one assigned.
const api = new Hono<AppEnv>();
api.use("/*", requireAuth);
api.route("/contractors", contractors);
api.route("/", signup);

// Platform-level: creating organizations. No tenant involved — gated purely
// on Cognito PlatformAdmins group membership.
api.use("/admin/*", requirePlatformAdmin);
api.route("/admin", admin);

// Everything else is tenant data, admin-only, and 403s without a resolved
// contractorId. Every top-level path these route modules actually define —
// bare and nested — needs to be listed here.
const tenantAdminPrefixes = [
  "/officers",
  "/licences",
  "/dbs",
  "/reference-checks",
  "/vetting",
  "/vetting-submissions",
  "/vetting-invites",
  "/qualifications",
  "/documents",
  "/invitations",
  "/team",
  "/audit-log",
];
for (const prefix of tenantAdminPrefixes) {
  api.use(prefix, requireContractor, requireAdmin);
  api.use(`${prefix}/*`, requireContractor, requireAdmin);
}
api.route("/officers", officers);
api.route("/", licences);
api.route("/", dbs);
api.route("/", referenceChecks);
api.route("/", vetting);
api.route("/", vettingSubmissions);
api.route("/", vettingInvites);
api.route("/", qualifications);
api.route("/", documents);
api.route("/", invitations);
api.route("/", team);
api.route("/", auditLog);

app.route("/", api);
