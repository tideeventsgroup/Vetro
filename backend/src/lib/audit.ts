import type { Prisma } from "@prisma/client";
import { getDb } from "../db/client.js";

export async function recordAudit(params: {
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Prisma.InputJsonValue;
}) {
  const db = await getDb();
  await db.auditLogEntry.create({
    data: {
      actorEmail: params.actorEmail,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      metadata: params.metadata,
    },
  });
}
