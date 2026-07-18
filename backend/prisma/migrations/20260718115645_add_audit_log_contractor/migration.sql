-- AlterTable
ALTER TABLE "AuditLogEntry" ADD COLUMN     "contractorId" TEXT;

-- CreateIndex
CREATE INDEX "AuditLogEntry_contractorId_createdAt_idx" ON "AuditLogEntry"("contractorId", "createdAt");

