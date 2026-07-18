-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "VettingSubmission" (
    "id" TEXT NOT NULL,
    "officerId" TEXT NOT NULL,
    "addressHistory" JSONB NOT NULL,
    "employmentHistory" JSONB NOT NULL,
    "references" JSONB NOT NULL,
    "consentGiven" BOOLEAN NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewNotes" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VettingSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VettingSubmission_officerId_idx" ON "VettingSubmission"("officerId");

-- AddForeignKey
ALTER TABLE "VettingSubmission" ADD CONSTRAINT "VettingSubmission_officerId_fkey" FOREIGN KEY ("officerId") REFERENCES "Officer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

