import type { Prisma } from "@prisma/client";
import { getDb } from "../db/client.js";

export async function recordAudit(params: {
  organisationId?: string;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Prisma.InputJsonValue;
}) {
  const db = await getDb();
  await db.auditLogEntry.create({
    data: {
      organisationId: params.organisationId,
      actorEmail: params.actorEmail,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      metadata: params.metadata,
    },
  });
}
