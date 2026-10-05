import { z } from 'zod';

import { catalogItemSchema } from './catalog';

/** One owned item as the API returns it, with its catalog entry embedded. */
export const collectionItemSchema = z.object({
  id: z.uuid(),
  addedAt: z.iso.datetime(),
  notes: z.string().optional(),
  catalog: catalogItemSchema,
});

export type CollectionItemResponse = z.infer<typeof collectionItemSchema>;

/** GET /collection: the signed-in user's items, newest first. */
export const collectionResponseSchema = z.object({ items: z.array(collectionItemSchema) });

export type CollectionResponse = z.infer<typeof collectionResponseSchema>;

/** POST /collection body. */
export const addToCollectionRequestSchema = z.object({ catalogItemId: z.uuid() });

export type AddToCollectionRequest = z.infer<typeof addToCollectionRequestSchema>;
