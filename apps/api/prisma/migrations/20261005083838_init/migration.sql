-- CreateEnum
CREATE TYPE "Category" AS ENUM ('book', 'manga', 'comic', 'lego');

-- CreateEnum
CREATE TYPE "CatalogSource" AS ENUM ('openlibrary', 'rebrickable');

-- CreateTable
CREATE TABLE "catalog_item" (
    "id" UUID NOT NULL,
    "category" "Category" NOT NULL,
    "source" "CatalogSource" NOT NULL,
    "external_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "creators" TEXT[],
    "year" INTEGER,
    "publisher" TEXT,
    "isbn13" CHAR(13),
    "set_number" TEXT,
    "piece_count" INTEGER,
    "cover_url" TEXT,
    "fetched_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "catalog_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "catalog_item_isbn13_idx" ON "catalog_item"("isbn13");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_item_source_external_id_key" ON "catalog_item"("source", "external_id");
