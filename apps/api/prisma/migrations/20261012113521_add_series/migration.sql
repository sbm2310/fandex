-- CreateTable
CREATE TABLE "series" (
    "wikidata_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "entries" JSONB NOT NULL,
    "extras" JSONB NOT NULL,
    "fetched_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "series_pkey" PRIMARY KEY ("wikidata_id")
);

-- CreateTable
CREATE TABLE "work_series" (
    "work_key" TEXT NOT NULL,
    "series_wikidata_id" TEXT,
    "checked_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_series_pkey" PRIMARY KEY ("work_key")
);

-- CreateIndex
CREATE INDEX "work_series_series_wikidata_id_idx" ON "work_series"("series_wikidata_id");

-- AddForeignKey
ALTER TABLE "work_series" ADD CONSTRAINT "work_series_series_wikidata_id_fkey" FOREIGN KEY ("series_wikidata_id") REFERENCES "series"("wikidata_id") ON DELETE SET NULL ON UPDATE CASCADE;
