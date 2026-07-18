-- AlterTable
ALTER TABLE "Contractor" ADD COLUMN     "slug" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Contractor_slug_key" ON "Contractor"("slug");

