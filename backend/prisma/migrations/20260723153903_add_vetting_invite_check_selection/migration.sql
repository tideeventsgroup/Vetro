-- AlterTable
ALTER TABLE "VettingInvite" ADD COLUMN     "dbsCertificateNumber" TEXT,
ADD COLUMN     "dbsIssueDate" TIMESTAMP(3),
ADD COLUMN     "dbsLevel" "DbsLevel",
ADD COLUMN     "requiresDbs" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requiresRightToWork" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rightToWorkConfirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rightToWorkDocumentType" TEXT,
ADD COLUMN     "rightToWorkExpiryDate" TIMESTAMP(3);
