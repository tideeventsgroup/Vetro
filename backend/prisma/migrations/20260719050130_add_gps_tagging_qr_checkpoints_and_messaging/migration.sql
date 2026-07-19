-- AlterTable
ALTER TABLE "Incident" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "accuracyM" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "CheckpointScan" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "accuracyM" DOUBLE PRECISION;

-- AlterTable: qrCode added nullable first so existing rows can be backfilled
ALTER TABLE "Checkpoint" ADD COLUMN     "qrCode" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "geofenceRadiusM" INTEGER;

-- Backfill existing checkpoints with a unique opaque token
UPDATE "Checkpoint" SET "qrCode" = substr(md5(random()::text || clock_timestamp()::text || "id"), 1, 25) WHERE "qrCode" IS NULL;

-- AlterTable
ALTER TABLE "Checkpoint" ALTER COLUMN "qrCode" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Checkpoint_qrCode_key" ON "Checkpoint"("qrCode");

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "senderEmail" TEXT NOT NULL,
    "recipientId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageRead" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "officerId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageRead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Message_contractorId_idx" ON "Message"("contractorId");

-- CreateIndex
CREATE INDEX "Message_recipientId_idx" ON "Message"("recipientId");

-- CreateIndex
CREATE INDEX "Message_createdAt_idx" ON "Message"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MessageRead_messageId_officerId_key" ON "MessageRead"("messageId", "officerId");

-- CreateIndex
CREATE INDEX "MessageRead_officerId_idx" ON "MessageRead"("officerId");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Officer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
