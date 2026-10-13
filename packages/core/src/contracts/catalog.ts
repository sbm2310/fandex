import { z } from 'zod';

import { CATEGORIES } from '../category';
import { parseSetNumber } from '../catalog-set';
import { parseFigureNumber } from '../figures/figure-number';
import { parseIsbn } from '../isbn';
import { moneySchema } from './money';
import { releaseDateSchema } from './release-date';
import { characterRefSchema, slugSchema } from './universe';

/** A catalog entry as the API returns it: cached in our database, with our own id. */
export const catalogItemSchema = z.object({
  id: z.uuid(),
  category: z.enum(CATEGORIES),
  /**
   * "fandex": a figure from Fandex's curated list (shared); "custom": a figure its owner added
   * by hand (private to them).
   */
  source: z.enum(['openlibrary', 'rebrickable', 'fandex', 'custom']),
  externalId: z.string(),
  title: z.string(),
  subtitle: z.string().optional(),
  creators: z.array(z.string()),
  year: z.number().int().optional(),
  /** Books: the edition's publication date as precise as Open Library knows it (upcoming too). */
  publishDate: releaseDateSchema.optional(),
  publisher: z.string().optional(),
  isbn13: z.string().length(13).optional(),
  /** Open Library work id ("OL27482W"): the same book in every edition. */
  workKey: z.string().optional(),
  coverUrl: z.url().optional(),
  /** LEGO only: the set number as printed on the box ("75192"). */
  setNumber: z.string().optional(),
  /** LEGO only. */
  pieceCount: z.number().int().optional(),
  /** LEGO: top-level theme ("Star Wars") and sub-theme ("Ultimate Collector Series"). */
  theme: z.string().optional(),
  subtheme: z.string().optional(),
  /** Figures only: "1/6". (A figure's brand is its creator, its line the subtitle.) */
  scale: z.string().optional(),
  /** Figures only: the number on the box ("MMS 649"). */
  figureNumber: z.string().optional(),
  /** Figures only: "Deluxe", "Premium"… */
  edition: z.string().optional(),
  /** Figures only: when it came out or is expected. */
  releaseDate: releaseDateSchema.optional(),
  /** Figures only: the original retail price. */
  price: moneySchema.optional(),
  /** Curated figures: the pages its facts were checked against. */
  sources: z.array(z.string()).optional(),
  /** The universes this item belongs to (slugs; see GET /universes), in seed order. */
  universes: z.array(slugSchema).default([]),
  /** The characters in it, each with its universe. */
  characters: z.array(characterRefSchema).default([]),
});

export type CatalogItemResponse = z.infer<typeof catalogItemSchema>;

/** GET /catalog/search?q= */
export const catalogSearchResponseSchema = z.object({ items: z.array(catalogItemSchema) });

export type CatalogSearchResponse = z.infer<typeof catalogSearchResponseSchema>;

/**
 * What to search: books (incl. manga and comics, via Open Library), LEGO sets (Rebrickable) or
 * figures (Fandex's own shared catalog).
 */
export const catalogSearchKindSchema = z.enum(['books', 'lego', 'figures']).default('books');

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

/** A figure number in any common spelling ("mms649"), written our way ("MMS 649"). */
export const figureNumberSchema = z.string().transform((value, ctx) => {
  const number = parseFigureNumber(value);
  if (!number) {
    ctx.addIssue({ code: 'custom', message: 'Not a figure number we know (e.g. "MMS 649")' });
    return z.NEVER;
  }
  return number.text;
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

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || undefined)
    .optional();

/** POST /catalog/custom: a figure added by hand. Blank optional fields are dropped. */
export const createFigureRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  brand: optionalText(100),
  line: optionalText(150),
  scale: optionalText(30),
  /** A picture of it on the web (https only). */
  coverUrl: z
    .url({ protocol: /^https$/, error: 'The image must be an https:// link' })
    .max(2000)
    .optional(),
  /** As printed on the box ("MMS 649"); written our way when it's a number we know. */
  number: optionalText(30),
  /** "Deluxe", "Premium"… */
  edition: optionalText(50),
  /** When it came out, or is expected to. */
  release: releaseDateSchema.optional(),
  /** Its original retail price. */
  price: moneySchema.optional(),
});
export type CreateFigureRequest = z.infer<typeof createFigureRequestSchema>;
