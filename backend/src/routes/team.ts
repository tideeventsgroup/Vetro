import { Hono } from "hono";
import { recordAudit } from "../lib/audit.js";
import { deleteUser, getUserAttributes, listUsersByOrganisation } from "../lib/cognito.js";
import type { AppEnv } from "../lib/hono-env.js";

export const team = new Hono<AppEnv>();

// Who's on this org's admin team — ADMIN and REVIEWER accounts both; not
// candidates, who have no Cognito account at all (see routes/candidatePublic.ts).
team.get("/team", async (c) => {
  const organisationId = c.get("organisationId")!;
  const users = await listUsersByOrganisation(organisationId);
  return c.json(users.filter((u) => u.role === "ADMIN" || u.role === "REVIEWER"));
});

// Username here is opaque (Cognito's sub-derived id, not the email) — always
// re-verified against the caller's own organisationId server-side rather
// than trusted from the URL, so one org's admin can never reach into
// another's account list just by guessing/enumerating usernames.
team.delete("/team/:username", async (c) => {
  const username = c.req.param("username");
  const attrs = await getUserAttributes(username).catch(() => undefined);
  if (!attrs || attrs["custom:contractor_id"] !== c.get("organisationId")) {
    return c.json({ error: "Teammate not found" }, 404);
  }
  if (attrs.email === c.get("actorEmail")) {
    return c.json({ error: "You can't remove your own account" }, 400);
  }

  await deleteUser(username);

  await recordAudit({
    organisationId: c.get("organisationId"),
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "teammate.removed",
    entityType: "Organisation",
    entityId: c.get("organisationId")!,
    metadata: { removedEmail: attrs.email },
  });

  return c.body(null, 204);
});
