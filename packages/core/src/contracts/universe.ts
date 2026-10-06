import { z } from 'zod';

/** A URL-safe id from the universe seed: "middle-earth", "gandalf". */
export const slugSchema = z
  .string()
  .max(100)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Not a valid slug');

/** A character in a universe, as catalog items and collection items refer to it. */
export const characterRefSchema = z.object({ universe: slugSchema, character: slugSchema });

/** GET /universes: one universe. */
export const universeSummarySchema = z.object({
  slug: slugSchema,
  name: z.string(),
  description: z.string(),
  /** Wikidata item, e.g. "Q81738". */
  wikidataId: z.string(),
});

export type UniverseSummary = z.infer<typeof universeSummarySchema>;

export const universeCharacterSchema = z.object({
  slug: slugSchema,
  name: z.string(),
  wikidataId: z.string(),
});

export type UniverseCharacter = z.infer<typeof universeCharacterSchema>;

/** GET /universes/:slug: a universe with its characters, in seed order. */
export const universeDetailSchema = universeSummarySchema.extend({
  characters: z.array(universeCharacterSchema),
});

export type UniverseDetail = z.infer<typeof universeDetailSchema>;

/** GET /universes */
export const universeListResponseSchema = z.object({ universes: z.array(universeSummarySchema) });

export type UniverseListResponse = z.infer<typeof universeListResponseSchema>;
