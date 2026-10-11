-- AlterTable
ALTER TABLE "catalog_item" ADD COLUMN     "publish_date" DATE,
ADD COLUMN     "publish_precision" "ReleasePrecision";

-- AlterTable
ALTER TABLE "preorder" ADD COLUMN     "follows_catalog_date" BOOLEAN NOT NULL DEFAULT false;
