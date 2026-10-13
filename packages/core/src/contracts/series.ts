import { z } from 'zod';

import type { BookSeries, SeriesEntry } from '../catalogs/wikidata-series';

export const seriesEntrySchema = z.object({
  wikidataId: z.string(),
  title: z.string(),
  workKey: z.string().exactOptional(),
  ordinal: z.number().exactOptional(),
  published: z.iso.date().exactOptional(),
}) satisfies z.ZodType<SeriesEntry>;

export const bookSeriesSchema = z.object({
  wikidataId: z.string(),
  name: z.string(),
  entries: z.array(seriesEntrySchema),
  extras: z.array(seriesEntrySchema),
}) satisfies z.ZodType<BookSeries>;

/**
 * GET /series/works?keys=OL1W,OL2W: the series of each work (null: none), each series once.
 * `pending`: Wikidata couldn't be asked about it yet (slow or busy); ask again shortly.
 */
export const workSeriesResponseSchema = z.object({
  works: z.array(
    z.object({
      workKey: z.string(),
      seriesId: z.string().nullable(),
      pending: z.boolean().default(false),
    }),
  ),
  series: z.array(bookSeriesSchema),
});
export type WorkSeriesResponse = z.infer<typeof workSeriesResponseSchema>;

const workKey = z.string().regex(/^OL\d+W$/, 'Not an Open Library work id');

/** Path parameter: an Open Library work id ("OL27482W"). */
export const workKeyParamSchema = workKey;

/** Query for GET /series/works: up to 50 comma-separated work ids, each once. */
export const workKeysQuerySchema = z
  .string()
  .transform((value) => [
    ...new Set(
      value
        .split(',')
        .map((key) => key.trim())
        .filter(Boolean),
    ),
  ])
  .pipe(z.array(workKey).min(1).max(50));
