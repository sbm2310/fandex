import { z } from 'zod';

import { BOOK_CATEGORIES, CATEGORIES } from '../category';
import type { LinkEdits } from '../universes/link-edits';
import { catalogItemSchema } from './catalog';
import { characterRefSchema, slugSchema } from './universe';

/** A user's fixes to an item's automatic universe links (see LinkEdits). */
export const linkEditsSchema = z.object({
  addedUniverses: z.array(slugSchema).exactOptional(),
  removedUniverses: z.array(slugSchema).exactOptional(),
  addedCharacters: z.array(characterRefSchema).exactOptional(),
  removedCharacters: z.array(characterRefSchema).exactOptional(),
}) satisfies z.ZodType<LinkEdits>;

/** One owned item as the API returns it, with its catalog entry embedded. */
export const collectionItemSchema = z.object({
  id: z.uuid(),
  addedAt: z.iso.datetime(),
  notes: z.string().optional(),
  /** What the user sees: the catalog's category unless they corrected it (books only). */
  category: z.enum(CATEGORIES).optional(),
  /** The user's fixes; `catalog.universes`/`characters` stay the automatic links. */
  linkEdits: linkEditsSchema.optional(),
  catalog: catalogItemSchema,
});

export type CollectionItemResponse = z.infer<typeof collectionItemSchema>;

/** GET /collection: the signed-in user's items, newest first. */
export const collectionResponseSchema = z.object({ items: z.array(collectionItemSchema) });

export type CollectionResponse = z.infer<typeof collectionResponseSchema>;

/** POST /collection body. */
export const addToCollectionRequestSchema = z.object({ catalogItemId: z.uuid() });

export type AddToCollectionRequest = z.infer<typeof addToCollectionRequestSchema>;

/**
 * PATCH /collection/:id body. For each field, null resets it to the automatic value and
 * leaving it out keeps it. `links` is the full set of universes and characters wanted.
 */
export const updateCollectionItemRequestSchema = z
  .object({
    category: z.enum(BOOK_CATEGORIES).nullable().exactOptional(),
    links: z
      .object({ universes: z.array(slugSchema), characters: z.array(characterRefSchema) })
      .nullable()
      .exactOptional(),
  })
  .refine((body) => body.category !== undefined || body.links !== undefined, {
    message: 'Nothing to change',
  });

export type UpdateCollectionItemRequest = z.infer<typeof updateCollectionItemRequestSchema>;
