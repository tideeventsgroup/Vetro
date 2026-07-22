-- CreateEnum
CREATE TYPE "DbsLevel" AS ENUM ('BASIC', 'STANDARD', 'ENHANCED');

-- CreateEnum
CREATE TYPE "ReferenceCheckStatus" AS ENUM ('PENDING', 'RECEIVED', 'UNABLE_TO_CONTACT', 'FLAGGED');

-- AlterTable
ALTER TABLE "Officer" ADD COLUMN     "rightToWorkDocumentType" TEXT,
ADD COLUMN     "rightToWorkExpiryDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "DbsCheck" (
    "id" TEXT NOT NULL,
    "officerId" TEXT NOT NULL,
    "level" "DbsLevel" NOT NULL,
    "certificateNumber" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "status" "ComplianceStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DbsCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferenceCheck" (
    "id" TEXT NOT NULL,
    "officerId" TEXT NOT NULL,
    "refereeName" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "relationship" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "status" "ReferenceCheckStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferenceCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DbsCheck_officerId_idx" ON "DbsCheck"("officerId");

-- CreateIndex
CREATE INDEX "DbsCheck_expiryDate_idx" ON "DbsCheck"("expiryDate");

-- CreateIndex
CREATE INDEX "ReferenceCheck_officerId_idx" ON "ReferenceCheck"("officerId");

-- AddForeignKey
ALTER TABLE "DbsCheck" ADD CONSTRAINT "DbsCheck_officerId_fkey" FOREIGN KEY ("officerId") REFERENCES "Officer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferenceCheck" ADD CONSTRAINT "ReferenceCheck_officerId_fkey" FOREIGN KEY ("officerId") REFERENCES "Officer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
