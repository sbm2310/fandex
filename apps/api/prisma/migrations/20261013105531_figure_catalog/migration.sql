-- AlterEnum
ALTER TYPE "CatalogSource" ADD VALUE 'fandex';

-- AlterTable
ALTER TABLE "catalog_item" ADD COLUMN     "edition" TEXT,
ADD COLUMN     "figure_number" TEXT,
ADD COLUMN     "price_amount" INTEGER,
ADD COLUMN     "price_currency" CHAR(3),
ADD COLUMN     "release_date" DATE,
ADD COLUMN     "release_precision" "ReleasePrecision",
ADD COLUMN     "sources" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "catalog_item_figure_number_idx" ON "catalog_item"("figure_number");
