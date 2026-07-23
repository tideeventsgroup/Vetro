-- DropForeignKey
ALTER TABLE "Alert" DROP CONSTRAINT "Alert_contractorId_fkey";

-- DropForeignKey
ALTER TABLE "Alert" DROP CONSTRAINT "Alert_officerId_fkey";

-- DropForeignKey
ALTER TABLE "Alert" DROP CONSTRAINT "Alert_shiftId_fkey";

-- DropForeignKey
ALTER TABLE "Checkpoint" DROP CONSTRAINT "Checkpoint_contractorId_fkey";

-- DropForeignKey
ALTER TABLE "Checkpoint" DROP CONSTRAINT "Checkpoint_siteId_fkey";

-- DropForeignKey
ALTER TABLE "CheckpointScan" DROP CONSTRAINT "CheckpointScan_checkpointId_fkey";

-- DropForeignKey
ALTER TABLE "CheckpointScan" DROP CONSTRAINT "CheckpointScan_contractorId_fkey";

-- DropForeignKey
ALTER TABLE "CheckpointScan" DROP CONSTRAINT "CheckpointScan_officerId_fkey";

-- DropForeignKey
ALTER TABLE "Incident" DROP CONSTRAINT "Incident_contractorId_fkey";

-- DropForeignKey
ALTER TABLE "Incident" DROP CONSTRAINT "Incident_officerId_fkey";

-- DropForeignKey
ALTER TABLE "Incident" DROP CONSTRAINT "Incident_siteId_fkey";

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_contractorId_fkey";

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_recipientId_fkey";

-- DropForeignKey
ALTER TABLE "MessageRead" DROP CONSTRAINT "MessageRead_messageId_fkey";

-- DropForeignKey
ALTER TABLE "MessageRead" DROP CONSTRAINT "MessageRead_officerId_fkey";

-- DropForeignKey
ALTER TABLE "Officer" DROP CONSTRAINT "Officer_siteId_fkey";

-- DropForeignKey
ALTER TABLE "Shift" DROP CONSTRAINT "Shift_contractorId_fkey";

-- DropForeignKey
ALTER TABLE "Shift" DROP CONSTRAINT "Shift_officerId_fkey";

-- DropForeignKey
ALTER TABLE "Shift" DROP CONSTRAINT "Shift_siteId_fkey";

-- DropForeignKey
ALTER TABLE "Site" DROP CONSTRAINT "Site_contractorId_fkey";

-- DropForeignKey
ALTER TABLE "VisitorLogEntry" DROP CONSTRAINT "VisitorLogEntry_contractorId_fkey";

-- DropForeignKey
ALTER TABLE "VisitorLogEntry" DROP CONSTRAINT "VisitorLogEntry_officerId_fkey";

-- DropForeignKey
ALTER TABLE "VisitorLogEntry" DROP CONSTRAINT "VisitorLogEntry_siteId_fkey";

-- AlterTable
ALTER TABLE "Officer" DROP COLUMN "siteId";

-- DropTable
DROP TABLE "Alert";

-- DropTable
DROP TABLE "Checkpoint";

-- DropTable
DROP TABLE "CheckpointScan";

-- DropTable
DROP TABLE "Incident";

-- DropTable
DROP TABLE "Message";

-- DropTable
DROP TABLE "MessageRead";

-- DropTable
DROP TABLE "Shift";

-- DropTable
DROP TABLE "Site";

-- DropTable
DROP TABLE "VisitorLogEntry";

-- DropEnum
DROP TYPE "AlertStatus";

-- DropEnum
DROP TYPE "AlertType";

-- DropEnum
DROP TYPE "IncidentCategory";

-- DropEnum
DROP TYPE "ShiftStatus";

