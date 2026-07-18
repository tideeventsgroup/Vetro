import { Hono } from "hono";
import { getDb } from "../db/client.js";
import { recordAudit } from "../lib/audit.js";
import { deriveStatus } from "../lib/status.js";
import type { AppEnv } from "../lib/hono-env.js";

export const vettingSubmissions = new Hono<AppEnv>();

// The admin-facing side of the officer self-service portal's vetting form
// (see routes/me.ts) — Vetro still doesn't perform the BS7858 check itself;
// this is where an admin looks at what an officer submitted and decides
// whether it becomes an authoritative VettingRecord.
vettingSubmissions.get("/vetting-submissions", async (c) => {
  const db = await getDb();
  const status = c.req.query("status");
  const rows = await db.vettingSubmission.findMany({
    where: {
      officer: { contractorId: c.get("contractorId") },
      ...(status ? { status: status as "PENDING_REVIEW" | "APPROVED" | "REJECTED" } : {}),
    },
    include: { officer: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { submittedAt: "desc" },
  });
  return c.json(rows);
});

vettingSubmissions.patch("/vetting-submissions/:id", async (c) => {
  const db = await getDb();
  const id = c.req.param("id");
  const existing = await db.vettingSubmission.findUnique({ where: { id }, include: { officer: true } });
  if (!existing || existing.officer.contractorId !== c.get("contractorId")) {
    return c.json({ error: "Submission not found" }, 404);
  }
  if (existing.status !== "PENDING_REVIEW") {
    return c.json({ error: "This submission has already been reviewed" }, 409);
  }

  const body = await c.req.json<{
    status: "APPROVED" | "REJECTED";
    reviewNotes?: string;
    expiryDate?: string;
  }>();
  if (body.status !== "APPROVED" && body.status !== "REJECTED") {
    return c.json({ error: "status must be APPROVED or REJECTED" }, 400);
  }

  const actorEmail = c.get("actorEmail") ?? "unknown";
  const reviewedSubmission = await db.vettingSubmission.update({
    where: { id },
    data: {
      status: body.status,
      reviewedAt: new Date(),
      reviewedBy: actorEmail,
      reviewNotes: body.reviewNotes,
    },
  });

  // Approving is what actually turns "what the officer claimed" into "the
  // record" — a fresh VettingRecord, editable afterwards the same way one
  // created directly by an admin already is (PATCH /vetting/:id).
  if (body.status === "APPROVED") {
    const expiryDate = body.expiryDate ? new Date(body.expiryDate) : null;
    await db.vettingRecord.create({
      data: {
        officerId: existing.officerId,
        standard: "BS7858",
        completedDate: new Date(),
        expiryDate,
        status: deriveStatus(expiryDate),
        notes: body.reviewNotes,
      },
    });
  }

  await recordAudit({
    contractorId: c.get("contractorId"),
    actorEmail,
    action: body.status === "APPROVED" ? "vetting_submission.approved" : "vetting_submission.rejected",
    entityType: "VettingSubmission",
    entityId: id,
  });

  return c.json(reviewedSubmission);
});
