-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- AlterTable
ALTER TABLE "Shift" ADD COLUMN     "lastLat" DOUBLE PRECISION,
ADD COLUMN     "lastLng" DOUBLE PRECISION,
ADD COLUMN     "lastLocationAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "officerId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "accuracyM" DOUBLE PRECISION,
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedByEmail" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Alert_contractorId_idx" ON "Alert"("contractorId");

-- CreateIndex
CREATE INDEX "Alert_officerId_idx" ON "Alert"("officerId");

-- CreateIndex
CREATE INDEX "Alert_status_idx" ON "Alert"("status");

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_officerId_fkey" FOREIGN KEY ("officerId") REFERENCES "Officer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
