-- CreateEnum
CREATE TYPE "IncidentCategory" AS ENUM ('THEFT', 'VANDALISM', 'TRESPASSING', 'MEDICAL', 'FIRE_SAFETY', 'EQUIPMENT_FAULT', 'SUSPICIOUS_ACTIVITY', 'OTHER');

-- AlterTable
ALTER TABLE "Shift" ADD COLUMN     "clockInAt" TIMESTAMP(3),
ADD COLUMN     "clockOutAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "officerId" TEXT NOT NULL,
    "category" "IncidentCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "photoKeys" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Checkpoint" (
    "id" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Checkpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckpointScan" (
    "id" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "checkpointId" TEXT NOT NULL,
    "officerId" TEXT NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckpointScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitorLogEntry" (
    "id" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "officerId" TEXT NOT NULL,
    "visitorName" TEXT NOT NULL,
    "company" TEXT,
    "purpose" TEXT,
    "hostName" TEXT,
    "signedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signedOutAt" TIMESTAMP(3),

    CONSTRAINT "VisitorLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Incident_contractorId_idx" ON "Incident"("contractorId");

-- CreateIndex
CREATE INDEX "Incident_siteId_idx" ON "Incident"("siteId");

-- CreateIndex
CREATE INDEX "Incident_officerId_idx" ON "Incident"("officerId");

-- CreateIndex
CREATE INDEX "Incident_occurredAt_idx" ON "Incident"("occurredAt");

-- CreateIndex
CREATE INDEX "Checkpoint_contractorId_idx" ON "Checkpoint"("contractorId");

-- CreateIndex
CREATE INDEX "Checkpoint_siteId_idx" ON "Checkpoint"("siteId");

-- CreateIndex
CREATE INDEX "CheckpointScan_contractorId_idx" ON "CheckpointScan"("contractorId");

-- CreateIndex
CREATE INDEX "CheckpointScan_checkpointId_idx" ON "CheckpointScan"("checkpointId");

-- CreateIndex
CREATE INDEX "CheckpointScan_officerId_idx" ON "CheckpointScan"("officerId");

-- CreateIndex
CREATE INDEX "CheckpointScan_scannedAt_idx" ON "CheckpointScan"("scannedAt");

-- CreateIndex
CREATE INDEX "VisitorLogEntry_contractorId_idx" ON "VisitorLogEntry"("contractorId");

-- CreateIndex
CREATE INDEX "VisitorLogEntry_siteId_idx" ON "VisitorLogEntry"("siteId");

-- CreateIndex
CREATE INDEX "VisitorLogEntry_officerId_idx" ON "VisitorLogEntry"("officerId");

-- CreateIndex
CREATE INDEX "VisitorLogEntry_signedInAt_idx" ON "VisitorLogEntry"("signedInAt");

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_officerId_fkey" FOREIGN KEY ("officerId") REFERENCES "Officer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checkpoint" ADD CONSTRAINT "Checkpoint_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checkpoint" ADD CONSTRAINT "Checkpoint_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckpointScan" ADD CONSTRAINT "CheckpointScan_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckpointScan" ADD CONSTRAINT "CheckpointScan_checkpointId_fkey" FOREIGN KEY ("checkpointId") REFERENCES "Checkpoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckpointScan" ADD CONSTRAINT "CheckpointScan_officerId_fkey" FOREIGN KEY ("officerId") REFERENCES "Officer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitorLogEntry" ADD CONSTRAINT "VisitorLogEntry_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitorLogEntry" ADD CONSTRAINT "VisitorLogEntry_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitorLogEntry" ADD CONSTRAINT "VisitorLogEntry_officerId_fkey" FOREIGN KEY ("officerId") REFERENCES "Officer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
