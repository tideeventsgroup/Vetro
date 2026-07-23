import { Hono } from "hono";
import { cors } from "hono/cors";
import { admin } from "./routes/admin.js";
import { alerts } from "./routes/alerts.js";
import { auditLog } from "./routes/auditLog.js";
import { checkpoints } from "./routes/checkpoints.js";
import { client } from "./routes/client.js";
import { contractors } from "./routes/contractors.js";
import { incidents } from "./routes/incidents.js";
import { invitations } from "./routes/invitations.js";
import { kiosk } from "./routes/kiosk.js";
import { me } from "./routes/me.js";
import { messages } from "./routes/messages.js";
import { officers } from "./routes/officers.js";
import { reports } from "./routes/reports.js";
import { shifts } from "./routes/shifts.js";
import { signup } from "./routes/signup.js";
import { sites } from "./routes/sites.js";
import { team } from "./routes/team.js";
import { licences } from "./routes/licences.js";
import { dbs } from "./routes/dbs.js";
import { referenceChecks } from "./routes/referenceChecks.js";
import { vetting } from "./routes/vetting.js";
import { vettingSubmissions } from "./routes/vettingSubmissions.js";
import { vettingInvites } from "./routes/vettingInvites.js";
import { vettingInvitePublic } from "./routes/vettingInvitePublic.js";
import { qualifications } from "./routes/qualifications.js";
import { documents } from "./routes/documents.js";
import { dashboard } from "./routes/dashboard.js";
import { exports_ } from "./routes/exports.js";
import { visitorLog } from "./routes/visitorLog.js";
import {
  requireAdmin,
  requireAuth,
  requireClientSelf,
  requireContractor,
  requireOfficerSelf,
  requirePlatformAdmin,
} from "./lib/auth.js";
import type { AppEnv } from "./lib/hono-env.js";

export const app = new Hono<AppEnv>();

// Also handled by API Gateway's own CORS config once deployed (see
// infra/lib/api-stack.ts) — needed here too since local dev talks to this
// server directly, with no API Gateway in front of it.
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: [
      "Authorization",
      "Content-Type",
      "X-Vetro-Tenant",
      "X-Vetro-Role",
      "X-Vetro-Officer-Id",
      "X-Vetro-Site-Id",
      "X-Vetro-Platform-Admin",
    ],
  }),
);

app.get("/health", (c) => c.json({ status: "ok" }));

// Public, no Cognito session at all — a shared site device resolves the
// tenant from the SIN itself, then the officer from their PIN. Deliberately
// mounted here, before requireAuth below, not inside the api sub-app.
app.route("/", kiosk);

// Public in the same sense as kiosk above: a candidate invited via
// routes/vettingInvites.ts has no Cognito account yet — the token in the
// URL is what authorises this, not a session. Mounted under its own path
// (not /vetting-invites) so it can't collide with that admin-only prefix's
// requireContractor/requireAdmin guard below.
app.route("/", vettingInvitePublic);

// Verifies identity for everything below, but doesn't require a resolved
// tenant yet — /contractors/me and /contractors (dev-only creation) need to
// work for an account that doesn't have one assigned.
const api = new Hono<AppEnv>();
api.use("/*", requireAuth);
api.route("/contractors", contractors);
api.route("/", signup);

// Guard middleware below is scoped to explicit path prefixes rather than a
// blanket "/*" on a sub-app mounted at "/". Hono flattens a mounted sub-app's
// own "/*" into the parent's global "/*" once merged at the "/" prefix — with
// three sibling groups (platform, officer, tenant-admin) all needing to live
// under the same api instance, that would make each group's guard run (and
// potentially reject) requests meant for the other groups. Scoping every
// guard to only the real top-level paths it should cover avoids that.

// Platform-level: creating organizations. No tenant involved — gated purely
// on Cognito PlatformAdmins group membership.
api.use("/admin/*", requirePlatformAdmin);
api.route("/admin", admin);

// The officer self-service portal — scoped entirely by custom:officer_id,
// never by contractorId or an :id param (see routes/me.ts).
api.use("/me/*", requireOfficerSelf);
api.route("/me", me);

// The client self-service portal — scoped entirely by custom:site_id, never
// by contractorId or an :id param (see routes/client.ts).
api.use("/client/*", requireClientSelf);
api.route("/", client);

// Everything else is tenant data, admin-only (an OFFICER self-service login
// has no business here, only under /me/*), and 403s without a resolved
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
  "/dashboard",
  "/exports",
  "/invitations",
  "/team",
  "/audit-log",
  "/sites",
  "/shifts",
  "/reports",
  "/incidents",
  "/checkpoints",
  "/patrol-log",
  "/visitor-log",
  "/messages",
  "/alerts",
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
api.route("/dashboard", dashboard);
api.route("/exports", exports_);
api.route("/", invitations);
api.route("/", team);
api.route("/", auditLog);
api.route("/", sites);
api.route("/", shifts);
api.route("/", reports);
api.route("/", incidents);
api.route("/", checkpoints);
api.route("/", visitorLog);
api.route("/", messages);
api.route("/", alerts);

app.route("/", api);
