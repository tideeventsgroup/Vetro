-- Fresh start: this replaces the old Vetro workforce-management product
-- entirely with Lunara Screening's compliance-vetting data model. Every
-- old table/enum is dropped up front (CASCADE handles the FKs between
-- them, IF EXISTS makes this safe to run whether or not they're still
-- there) rather than diffed column-by-column, since nothing in the old
-- shape survives into the new one — see docs/PIVOT_PLAN.md and the
-- product brief this migration implements. No production data is
-- preserved by design (confirmed with the org before writing this).
DROP TABLE IF EXISTS "VettingInviteDocument" CASCADE;
DROP TABLE IF EXISTS "VettingInvite" CASCADE;
DROP TABLE IF EXISTS "VettingSubmission" CASCADE;
DROP TABLE IF EXISTS "ReferenceCheck" CASCADE;
DROP TABLE IF EXISTS "DbsCheck" CASCADE;
DROP TABLE IF EXISTS "VettingRecord" CASCADE;
DROP TABLE IF EXISTS "SiaLicence" CASCADE;
DROP TABLE IF EXISTS "Qualification" CASCADE;
DROP TABLE IF EXISTS "Document" CASCADE;
DROP TABLE IF EXISTS "Officer" CASCADE;
DROP TABLE IF EXISTS "Contractor" CASCADE;
DROP TABLE IF EXISTS "AuditLogEntry" CASCADE;

DROP TYPE IF EXISTS "ComplianceStatus" CASCADE;
DROP TYPE IF EXISTS "SubmissionStatus" CASCADE;
DROP TYPE IF EXISTS "VettingInviteStatus" CASCADE;
DROP TYPE IF EXISTS "DbsLevel" CASCADE;
DROP TYPE IF EXISTS "ReferenceCheckStatus" CASCADE;
DROP TYPE IF EXISTS "EmploymentType" CASCADE;
DROP TYPE IF EXISTS "EmploymentStatus" CASCADE;
DROP TYPE IF EXISTS "PayRateType" CASCADE;

-- CreateEnum
CREATE TYPE "CheckType" AS ENUM ('SIA_LICENCE', 'FIRST_AID', 'RIGHT_TO_WORK', 'ID_DOCUMENT', 'TRAINING', 'DBS_CHECK');

-- CreateEnum
CREATE TYPE "CheckStatus" AS ENUM ('NOT_STARTED', 'PENDING', 'VERIFIED', 'EXPIRED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CandidateStatus" AS ENUM ('INVITED', 'IN_PROGRESS', 'SUBMITTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DataRequestType" AS ENUM ('ACCESS', 'DELETE');

-- CreateEnum
CREATE TYPE "DataRequestStatus" AS ENUM ('PENDING', 'COMPLETED');

-- CreateTable
CREATE TABLE "Organisation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "retentionDays" INTEGER NOT NULL DEFAULT 365,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleType" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "requiredCheckTypes" "CheckType"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoleType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "roleTypeId" TEXT,
    "status" "CandidateStatus" NOT NULL DEFAULT 'INVITED',
    "inviteToken" TEXT NOT NULL,
    "invitedByEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Check" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "checkType" "CheckType" NOT NULL,
    "status" "CheckStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "licenceNumber" TEXT,
    "expiryDate" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Check_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "checkId" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataRequest" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT,
    "organisationId" TEXT NOT NULL,
    "type" "DataRequestType" NOT NULL,
    "status" "DataRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,

    CONSTRAINT "DataRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLogEntry" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT,
    "actorEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organisation_slug_key" ON "Organisation"("slug");

-- CreateIndex
CREATE INDEX "RoleType_organisationId_idx" ON "RoleType"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "RoleType_organisationId_name_key" ON "RoleType"("organisationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_inviteToken_key" ON "Candidate"("inviteToken");

-- CreateIndex
CREATE INDEX "Candidate_organisationId_idx" ON "Candidate"("organisationId");

-- CreateIndex
CREATE INDEX "Check_candidateId_idx" ON "Check"("candidateId");

-- CreateIndex
CREATE INDEX "Check_checkType_idx" ON "Check"("checkType");

-- CreateIndex
CREATE INDEX "Check_expiryDate_idx" ON "Check"("expiryDate");

-- CreateIndex
CREATE INDEX "Document_checkId_idx" ON "Document"("checkId");

-- CreateIndex
CREATE INDEX "DataRequest_candidateId_idx" ON "DataRequest"("candidateId");

-- CreateIndex
CREATE INDEX "DataRequest_organisationId_idx" ON "DataRequest"("organisationId");

-- CreateIndex
CREATE INDEX "AuditLogEntry_entityType_entityId_idx" ON "AuditLogEntry"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLogEntry_organisationId_createdAt_idx" ON "AuditLogEntry"("organisationId", "createdAt");

-- AddForeignKey
ALTER TABLE "RoleType" ADD CONSTRAINT "RoleType_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_roleTypeId_fkey" FOREIGN KEY ("roleTypeId") REFERENCES "RoleType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Check" ADD CONSTRAINT "Check_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_checkId_fkey" FOREIGN KEY ("checkId") REFERENCES "Check"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataRequest" ADD CONSTRAINT "DataRequest_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

