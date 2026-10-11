-- AlterEnum
ALTER TYPE "CatalogSource" ADD VALUE 'custom';

-- AlterEnum
ALTER TYPE "Category" ADD VALUE 'figure';

-- AlterTable
ALTER TABLE "catalog_item" ADD COLUMN     "owner_id" UUID,
ADD COLUMN     "scale" TEXT;

-- CreateIndex
CREATE INDEX "catalog_item_owner_id_idx" ON "catalog_item"("owner_id");

-- AddForeignKey
ALTER TABLE "catalog_item" ADD CONSTRAINT "catalog_item_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
