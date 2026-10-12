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
 * GET /series/works?keys=OL1W,OL2W: the series of each work (null: Wikidata knows none, or it
 * hasn't been asked yet and couldn't be now), each series once.
 */
export const workSeriesResponseSchema = z.object({
  works: z.array(z.object({ workKey: z.string(), seriesId: z.string().nullable() })),
  series: z.array(bookSeriesSchema),
});
export type WorkSeriesResponse = z.infer<typeof workSeriesResponseSchema>;
