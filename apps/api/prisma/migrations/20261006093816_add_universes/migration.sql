-- CreateTable
CREATE TABLE "universe" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "wikidata_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "universe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "character" (
    "id" UUID NOT NULL,
    "universe_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[],
    "wikidata_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_item_universe" (
    "catalog_item_id" UUID NOT NULL,
    "universe_id" UUID NOT NULL,

    CONSTRAINT "catalog_item_universe_pkey" PRIMARY KEY ("catalog_item_id","universe_id")
);

-- CreateTable
CREATE TABLE "catalog_item_character" (
    "catalog_item_id" UUID NOT NULL,
    "character_id" UUID NOT NULL,

    CONSTRAINT "catalog_item_character_pkey" PRIMARY KEY ("catalog_item_id","character_id")
);

-- CreateTable
CREATE TABLE "sync_state" (
    "name" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "synced_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_state_pkey" PRIMARY KEY ("name")
);

-- CreateIndex
CREATE UNIQUE INDEX "universe_slug_key" ON "universe"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "character_universe_id_slug_key" ON "character"("universe_id", "slug");

-- CreateIndex
CREATE INDEX "catalog_item_universe_universe_id_idx" ON "catalog_item_universe"("universe_id");

-- CreateIndex
CREATE INDEX "catalog_item_character_character_id_idx" ON "catalog_item_character"("character_id");

-- AddForeignKey
ALTER TABLE "character" ADD CONSTRAINT "character_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "universe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_item_universe" ADD CONSTRAINT "catalog_item_universe_catalog_item_id_fkey" FOREIGN KEY ("catalog_item_id") REFERENCES "catalog_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_item_universe" ADD CONSTRAINT "catalog_item_universe_universe_id_fkey" FOREIGN KEY ("universe_id") REFERENCES "universe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_item_character" ADD CONSTRAINT "catalog_item_character_catalog_item_id_fkey" FOREIGN KEY ("catalog_item_id") REFERENCES "catalog_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_item_character" ADD CONSTRAINT "catalog_item_character_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
