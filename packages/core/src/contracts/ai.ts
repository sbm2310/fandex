import { z } from 'zod';

import { SHELF_ITEM_KINDS, type ShelfReading } from '../ai/shelf-reading';
import { catalogItemSchema } from './catalog';

/** What the model read on a shelf photo: a guess, to be matched to the catalog. */
export const shelfReadingSchema = z.object({
  kind: z.enum(SHELF_ITEM_KINDS),
  title: z.string(),
  englishTitle: z.string().exactOptional(),
  author: z.string().exactOptional(),
  count: z.number().int().positive(),
  setNumber: z.string().exactOptional(),
}) satisfies z.ZodType<ShelfReading>;

/** A daily allowance: how much of it is used today (UTC). */
export const aiQuotaSchema = z.object({
  used: z.number().int().min(0),
  limit: z.number().int().min(0),
});
export type AiQuota = z.infer<typeof aiQuotaSchema>;

/** A catalog entry that could be what was read, and whether the user already owns it. */
export const shelfCandidateSchema = z.object({
  item: catalogItemSchema,
  owned: z.boolean(),
});
export type ShelfCandidate = z.infer<typeof shelfCandidateSchema>;

/** One thing on the shelf: what was read, and the catalog entries it could be (best first). */
export const shelfScanItemSchema = z.object({
  reading: shelfReadingSchema,
  /**
   * Both readings of the photo found it (see combineShelfReadings). Less sure items are
   * offered unticked. Defaults to sure for answers from before the photo was read twice.
   */
  sure: z.boolean().default(true),
  /** Empty when nothing in the catalog resembled the reading: offer a search instead. */
  candidates: z.array(shelfCandidateSchema),
});
export type ShelfScanItem = z.infer<typeof shelfScanItemSchema>;

/** POST /ai/shelf-scans (multipart: 1–3 JPEG `images`, the parts of one shelf photo). */
export const shelfScanResponseSchema = z.object({
  items: z.array(shelfScanItemSchema),
  /** Shelf scans after this one. */
  quota: aiQuotaSchema,
});
export type ShelfScanResponse = z.infer<typeof shelfScanResponseSchema>;

/** Who reads the photos, for the privacy note ("Your photo is sent to …"). */
export const aiProviderInfoSchema = z.object({
  name: z.string(),
  /** Free tiers may use what they receive to improve the provider's products. */
  usesPhotosForTraining: z.boolean(),
});
export type AiProviderInfo = z.infer<typeof aiProviderInfoSchema>;

/** GET /ai/quota: whether AI is available, today's allowance, and the provider. */
export const aiQuotaResponseSchema = z.object({
  available: z.boolean(),
  shelfScans: aiQuotaSchema,
  /** Absent from servers older than the provider setting. */
  provider: aiProviderInfoSchema.exactOptional(),
});
export type AiQuotaResponse = z.infer<typeof aiQuotaResponseSchema>;
