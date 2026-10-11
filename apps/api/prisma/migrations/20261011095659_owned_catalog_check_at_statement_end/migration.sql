-- DropForeignKey
ALTER TABLE "collection_item" DROP CONSTRAINT "collection_item_catalog_item_id_fkey";

-- AddForeignKey
ALTER TABLE "collection_item" ADD CONSTRAINT "collection_item_catalog_item_id_fkey" FOREIGN KEY ("catalog_item_id") REFERENCES "catalog_item"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
