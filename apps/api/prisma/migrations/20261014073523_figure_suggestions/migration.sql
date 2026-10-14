-- CreateEnum
CREATE TYPE "FigureSuggestionStatus" AS ENUM ('pending', 'approved', 'merged', 'rejected');

-- CreateTable
CREATE TABLE "figure_suggestion" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "catalog_item_id" UUID,
    "merged_into_id" UUID,
    "status" "FigureSuggestionStatus" NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "review_note" TEXT,
    "reviewed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "figure_suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "figure_suggestion_catalog_item_id_key" ON "figure_suggestion"("catalog_item_id");

-- CreateIndex
CREATE INDEX "figure_suggestion_status_created_at_idx" ON "figure_suggestion"("status", "created_at");

-- CreateIndex
CREATE INDEX "figure_suggestion_user_id_idx" ON "figure_suggestion"("user_id");

-- AddForeignKey
ALTER TABLE "figure_suggestion" ADD CONSTRAINT "figure_suggestion_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "figure_suggestion" ADD CONSTRAINT "figure_suggestion_catalog_item_id_fkey" FOREIGN KEY ("catalog_item_id") REFERENCES "catalog_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "figure_suggestion" ADD CONSTRAINT "figure_suggestion_merged_into_id_fkey" FOREIGN KEY ("merged_into_id") REFERENCES "catalog_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
