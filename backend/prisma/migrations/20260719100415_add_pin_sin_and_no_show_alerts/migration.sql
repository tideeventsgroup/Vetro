-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('SOS', 'NO_SHOW');

-- AlterTable
ALTER TABLE "Alert" ADD COLUMN     "shiftId" TEXT,
ADD COLUMN     "type" "AlertType" NOT NULL DEFAULT 'SOS';

-- AlterTable
ALTER TABLE "Officer" ADD COLUMN     "pin" TEXT;

-- AlterTable
ALTER TABLE "Site" ADD COLUMN     "sin" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Officer_contractorId_pin_key" ON "Officer"("contractorId", "pin");

-- CreateIndex
CREATE UNIQUE INDEX "Site_sin_key" ON "Site"("sin");

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

