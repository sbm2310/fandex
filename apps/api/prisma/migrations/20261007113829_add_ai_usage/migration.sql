-- CreateEnum
CREATE TYPE "AiUsageKind" AS ENUM ('shelf_scan');

-- CreateTable
CREATE TABLE "ai_usage" (
    "user_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "kind" "AiUsageKind" NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("user_id","day","kind")
);

-- CreateIndex
CREATE INDEX "ai_usage_day_kind_idx" ON "ai_usage"("day", "kind");

-- AddForeignKey
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
