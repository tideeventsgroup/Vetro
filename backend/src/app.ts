import { Hono } from "hono";
import { officers } from "./routes/officers.js";
import { licences } from "./routes/licences.js";
import { vetting } from "./routes/vetting.js";
import { dashboard } from "./routes/dashboard.js";
import { exports_ } from "./routes/exports.js";
import { requireAuth } from "./lib/auth.js";
import type { AppEnv } from "./lib/hono-env.js";

export const app = new Hono<AppEnv>();

app.get("/health", (c) => c.json({ status: "ok" }));

const api = new Hono<AppEnv>();
api.use("/*", requireAuth);
api.route("/officers", officers);
api.route("/", licences);
api.route("/", vetting);
api.route("/dashboard", dashboard);
api.route("/exports", exports_);

app.route("/", api);
