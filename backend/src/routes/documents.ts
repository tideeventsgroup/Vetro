import { Hono } from "hono";
import { getDb } from "../db/client.js";
import { recordAudit } from "../lib/audit.js";
import { createDownloadUrl, createUploadUrl } from "../lib/documents.js";
import type { AppEnv } from "../lib/hono-env.js";

export const documents = new Hono<AppEnv>();

async function requireOwnedOfficer(db: Awaited<ReturnType<typeof getDb>>, officerId: string, contractorId?: string) {
  const officer = await db.officer.findUnique({ where: { id: officerId } });
  return officer && officer.contractorId === contractorId ? officer : undefined;
}

// Two-step upload: the client asks for a presigned URL, PUTs the file to S3
// directly, then confirms here so a Document row only exists for files that
// actually made it to the bucket.
documents.post("/officers/:officerId/documents/upload-url", async (c) => {
  const db = await getDb();
  const officerId = c.req.param("officerId");
  if (!(await requireOwnedOfficer(db, officerId, c.get("contractorId")))) {
    return c.json({ error: "Officer not found" }, 404);
  }

  const body = await c.req.json<{ fileName: string; contentType: string }>();
  const { uploadUrl, s3Key } = await createUploadUrl({
    prefix: `officers/${officerId}`,
    fileName: body.fileName,
    contentType: body.contentType,
  });
  return c.json({ uploadUrl, s3Key });
});

documents.post("/officers/:officerId/documents", async (c) => {
  const db = await getDb();
  const officerId = c.req.param("officerId");
  if (!(await requireOwnedOfficer(db, officerId, c.get("contractorId")))) {
    return c.json({ error: "Officer not found" }, 404);
  }

  const body = await c.req.json<{ kind: string; s3Key: string }>();
  const created = await db.document.create({
    data: { officerId, kind: body.kind, s3Key: body.s3Key },
  });

  await recordAudit({
    contractorId: c.get("contractorId"),
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "document.created",
    entityType: "Document",
    entityId: created.id,
  });

  return c.json(created, 201);
});

documents.get("/documents/:id/download-url", async (c) => {
  const db = await getDb();
  const document = await db.document.findUnique({ where: { id: c.req.param("id") }, include: { officer: true } });
  if (!document || document.officer.contractorId !== c.get("contractorId")) {
    return c.json({ error: "Document not found" }, 404);
  }
  const downloadUrl = await createDownloadUrl(document.s3Key);
  return c.json({ downloadUrl });
});

documents.delete("/documents/:id", async (c) => {
  const db = await getDb();
  const id = c.req.param("id");
  const existing = await db.document.findUnique({ where: { id }, include: { officer: true } });
  if (!existing || existing.officer.contractorId !== c.get("contractorId")) {
    return c.json({ error: "Document not found" }, 404);
  }

  await db.document.delete({ where: { id } });
  await recordAudit({
    contractorId: c.get("contractorId"),
    actorEmail: c.get("actorEmail") ?? "unknown",
    action: "document.deleted",
    entityType: "Document",
    entityId: id,
  });
  return c.body(null, 204);
});
