import { z } from 'zod';

import { SHELF_ITEM_KINDS, type ShelfReading } from '../ai/shelf-reading';

/** What the model read on a shelf photo (unverified: Task 3 matches it to the catalog). */
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

/** POST /ai/shelf-scans (multipart: 1–3 JPEG `images`, the parts of one shelf photo). */
export const shelfScanResponseSchema = z.object({
  readings: z.array(shelfReadingSchema),
  /** Shelf scans after this one. */
  quota: aiQuotaSchema,
});
export type ShelfScanResponse = z.infer<typeof shelfScanResponseSchema>;

/** GET /ai/quota: whether AI is available, and today's allowance. */
export const aiQuotaResponseSchema = z.object({
  available: z.boolean(),
  shelfScans: aiQuotaSchema,
});
export type AiQuotaResponse = z.infer<typeof aiQuotaResponseSchema>;
