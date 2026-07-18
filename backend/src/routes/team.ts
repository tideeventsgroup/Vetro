import { Hono } from "hono";
import { recordAudit } from "../lib/audit.js";
import { deleteUser, getUserAttributes, listUsersByContractor } from "../lib/cognito.js";
import type { AppEnv } from "../lib/hono-env.js";

export const team = new Hono<AppEnv>();

// Who's on this org's admin team — not officers, who have their own
// self-service accounts (see routes/me.ts) and don't belong on this list.
team.get("/team", async (c) => {
  const contractorId = c.get("contractorId")!;
  const users = await listUsersByContractor(contractorId);
  return c.json(users.filter((u) => u.role === "ADMIN"));
});

// Username here is opaque (Cognito's sub-derived id, not the email) — always
// re-verified against the caller's own contractorId server-side rather than
// trusted from the URL, so one org's admin can never reach into another's
// account list just by guessing/enumerating usernames.
team.delete("/team/:username", async (c) => {
  const username = c.req.param("username");
  const attrs = await getUserAttributes(username).catch(() => undefined);
  if (!attrs || attrs["custom:contractor_id"] !== c.get("contractorId")) {
    return c.json({ error: "Teammate not found" }, 404);
  }
  if (attrs.email === c.get("actorEmail")) {
    return c.json({ error: "You can't remove your own account" }, 400);
  }

  await deleteUser(username);

  await recordAudit({
    contractorId: c.get("contractorId"),
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "teammate.removed",
    entityType: "Contractor",
    entityId: c.get("contractorId")!,
    metadata: { removedEmail: attrs.email },
  });

  return c.body(null, 204);
});
