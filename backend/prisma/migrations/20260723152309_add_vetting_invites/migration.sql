-- CreateEnum
CREATE TYPE "VettingInviteStatus" AS ENUM ('PENDING', 'SUBMITTED', 'CONVERTED');

-- CreateTable
CREATE TABLE "VettingInvite" (
    "id" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "token" TEXT NOT NULL,
    "status" "VettingInviteStatus" NOT NULL DEFAULT 'PENDING',
    "addressHistory" JSONB,
    "employmentHistory" JSONB,
    "references" JSONB,
    "consentGiven" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3),
    "convertedOfficerId" TEXT,
    "invitedByEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VettingInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VettingInvite_token_key" ON "VettingInvite"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VettingInvite_convertedOfficerId_key" ON "VettingInvite"("convertedOfficerId");

-- CreateIndex
CREATE INDEX "VettingInvite_contractorId_idx" ON "VettingInvite"("contractorId");

-- AddForeignKey
ALTER TABLE "VettingInvite" ADD CONSTRAINT "VettingInvite_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VettingInvite" ADD CONSTRAINT "VettingInvite_convertedOfficerId_fkey" FOREIGN KEY ("convertedOfficerId") REFERENCES "Officer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
