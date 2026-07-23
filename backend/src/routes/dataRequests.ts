import { Hono } from "hono";
import { getDb } from "../db/client.js";
import { recordAudit } from "../lib/audit.js";
import type { AppEnv } from "../lib/hono-env.js";

export const dataRequests = new Hono<AppEnv>();

// A candidate's own GDPR requests, raised via their magic link
// (routes/candidatePublic.ts) and worked off here by an admin/reviewer.
dataRequests.get("/data-requests", async (c) => {
  const db = await getDb();
  const rows = await db.dataRequest.findMany({
    where: { organisationId: c.get("organisationId") },
    include: { candidate: true },
    orderBy: { requestedAt: "desc" },
  });
  return c.json(rows);
});

// ACCESS just needs a human to confirm the candidate's already been shown
// everything held about them (their own magic link already lets them see
// it) — DELETE actually erases the candidate and everything cascading off
// them (see the onDelete: Cascade relations in prisma/schema.prisma), which
// is what makes this row proof the erasure genuinely happened.
dataRequests.post("/data-requests/:id/resolve", async (c) => {
  const db = await getDb();
  const id = c.req.param("id");
  const organisationId = c.get("organisationId");
  const existing = await db.dataRequest.findUnique({ where: { id } });
  if (!existing || existing.organisationId !== organisationId) {
    return c.json({ error: "Data request not found" }, 404);
  }
  if (existing.status === "COMPLETED") {
    return c.json({ error: "Data request is already resolved" }, 400);
  }

  const actorEmail = c.get("actorEmail") ?? "unknown";

  if (existing.type === "DELETE" && existing.candidateId) {
    const candidate = await db.candidate.findUnique({ where: { id: existing.candidateId } });
    if (candidate && candidate.organisationId === organisationId) {
      await db.candidate.delete({ where: { id: candidate.id } });
      await recordAudit({
        organisationId,
        actorEmail,
        action: "candidate.erased",
        entityType: "Candidate",
        entityId: candidate.id,
        metadata: { reason: "data_request", dataRequestId: id },
      });
    }
  }

  const resolved = await db.dataRequest.update({
    where: { id },
    data: { status: "COMPLETED", resolvedAt: new Date(), resolvedBy: actorEmail },
  });

  await recordAudit({
    organisationId,
    actorEmail,
    action: "data_request.resolved",
    entityType: "DataRequest",
    entityId: id,
    metadata: { type: existing.type },
  });

  return c.json(resolved);
});
