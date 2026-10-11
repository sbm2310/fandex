-- CreateEnum
CREATE TYPE "PreorderStatus" AS ENUM ('ordered', 'arrived', 'cancelled');

-- CreateEnum
CREATE TYPE "ReleasePrecision" AS ENUM ('day', 'month', 'quarter', 'year');

-- CreateEnum
CREATE TYPE "DateChangeSource" AS ENUM ('user', 'openlibrary');

-- CreateTable
CREATE TABLE "preorder" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "catalog_item_id" UUID NOT NULL,
    "status" "PreorderStatus" NOT NULL DEFAULT 'ordered',
    "currency" CHAR(3) NOT NULL,
    "price" INTEGER,
    "paid" INTEGER NOT NULL DEFAULT 0,
    "balance_due_date" DATE,
    "release_date" DATE,
    "release_precision" "ReleasePrecision",
    "store" TEXT,
    "order_number" TEXT,
    "order_url" TEXT,
    "notes" TEXT,
    "arrived_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "preorder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preorder_date_change" (
    "id" UUID NOT NULL,
    "preorder_id" UUID NOT NULL,
    "from_date" DATE,
    "from_precision" "ReleasePrecision",
    "to_date" DATE,
    "to_precision" "ReleasePrecision",
    "source" "DateChangeSource" NOT NULL,
    "changed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "preorder_date_change_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "preorder_user_id_idx" ON "preorder"("user_id");

-- CreateIndex
CREATE INDEX "preorder_catalog_item_id_idx" ON "preorder"("catalog_item_id");

-- CreateIndex
CREATE INDEX "preorder_date_change_preorder_id_changed_at_idx" ON "preorder_date_change"("preorder_id", "changed_at");

-- AddForeignKey
ALTER TABLE "preorder" ADD CONSTRAINT "preorder_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preorder" ADD CONSTRAINT "preorder_catalog_item_id_fkey" FOREIGN KEY ("catalog_item_id") REFERENCES "catalog_item"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preorder_date_change" ADD CONSTRAINT "preorder_date_change_preorder_id_fkey" FOREIGN KEY ("preorder_id") REFERENCES "preorder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
