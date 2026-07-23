-- AlterTable
ALTER TABLE "Officer" ADD COLUMN     "siteId" TEXT;

-- CreateTable
CREATE TABLE "VettingInviteDocument" (
    "id" TEXT NOT NULL,
    "vettingInviteId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VettingInviteDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VettingInviteDocument_vettingInviteId_idx" ON "VettingInviteDocument"("vettingInviteId");

-- AddForeignKey
ALTER TABLE "Officer" ADD CONSTRAINT "Officer_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VettingInviteDocument" ADD CONSTRAINT "VettingInviteDocument_vettingInviteId_fkey" FOREIGN KEY ("vettingInviteId") REFERENCES "VettingInvite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
