import { z } from 'zod';

import { CATEGORIES } from '../category';
import { parseSetNumber } from '../catalog-set';
import { parseIsbn } from '../isbn';
import { characterRefSchema, slugSchema } from './universe';

/** A catalog entry as the API returns it: cached in our database, with our own id. */
export const catalogItemSchema = z.object({
  id: z.uuid(),
  category: z.enum(CATEGORIES),
  source: z.enum(['openlibrary', 'rebrickable']),
  externalId: z.string(),
  title: z.string(),
  subtitle: z.string().optional(),
  creators: z.array(z.string()),
  year: z.number().int().optional(),
  publisher: z.string().optional(),
  isbn13: z.string().length(13).optional(),
  coverUrl: z.url().optional(),
  /** LEGO only: the set number as printed on the box ("75192"). */
  setNumber: z.string().optional(),
  /** LEGO only. */
  pieceCount: z.number().int().optional(),
  /** LEGO: top-level theme ("Star Wars") and sub-theme ("Ultimate Collector Series"). */
  theme: z.string().optional(),
  subtheme: z.string().optional(),
  /** The universes this item belongs to (slugs; see GET /universes), in seed order. */
  universes: z.array(slugSchema).default([]),
  /** The characters in it, each with its universe. */
  characters: z.array(characterRefSchema).default([]),
});

export type CatalogItemResponse = z.infer<typeof catalogItemSchema>;

/** GET /catalog/search?q= */
export const catalogSearchResponseSchema = z.object({ items: z.array(catalogItemSchema) });

export type CatalogSearchResponse = z.infer<typeof catalogSearchResponseSchema>;

/** What to search: books (incl. manga and comics, via Open Library) or LEGO sets (Rebrickable). */
export const catalogSearchKindSchema = z.enum(['books', 'lego']).default('books');

export type CatalogSearchKind = z.infer<typeof catalogSearchKindSchema>;

/** Path parameter for GET /catalog/lego/:setNumber, normalized to Rebrickable form ("75192-1"). */
export const setNumberParamSchema = z.string().transform((value, ctx) => {
  const setNum = parseSetNumber(value);
  if (!setNum) {
    ctx.addIssue({ code: 'custom', message: 'Not a valid LEGO set number' });
    return z.NEVER;
  }
  return setNum;
});

/** Query for GET /catalog/search: trimmed, 2–200 characters. */
export const catalogSearchQuerySchema = z.string().trim().min(2).max(200);

/** Path parameter for GET /catalog/isbn/:isbn: any ISBN-10/13 form, normalized to ISBN-13. */
export const isbnParamSchema = z.string().transform((value, ctx) => {
  const isbn = parseIsbn(value);
  if (!isbn) {
    ctx.addIssue({ code: 'custom', message: 'Not a valid ISBN' });
    return z.NEVER;
  }
  return isbn;
});
