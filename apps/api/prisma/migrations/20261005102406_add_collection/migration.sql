-- CreateTable
CREATE TABLE "collection_item" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "catalog_item_id" UUID NOT NULL,
    "added_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "collection_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "collection_item_user_id_added_at_idx" ON "collection_item"("user_id", "added_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "collection_item_user_id_catalog_item_id_key" ON "collection_item"("user_id", "catalog_item_id");

-- AddForeignKey
ALTER TABLE "collection_item" ADD CONSTRAINT "collection_item_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_item" ADD CONSTRAINT "collection_item_catalog_item_id_fkey" FOREIGN KEY ("catalog_item_id") REFERENCES "catalog_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
