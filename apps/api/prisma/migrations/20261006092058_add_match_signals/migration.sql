-- AlterTable
ALTER TABLE "catalog_item" ADD COLUMN     "match_signals" JSONB,
ADD COLUMN     "work_key" TEXT;

-- CreateIndex
CREATE INDEX "catalog_item_work_key_idx" ON "catalog_item"("work_key");
