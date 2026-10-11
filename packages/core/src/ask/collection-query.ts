import { z } from 'zod';

import { formatTitle } from '../catalog-book';
import type { Currency } from '../preorders/money';
import { CATEGORIES, type Category } from '../category';
import { itemLinks, type CollectionItem } from '../collection-item';
import { compareTitles } from '../sort-collection';
import type { CharacterRef } from '../universes/match-universes';
import { containsPhrase, normalizeText } from '../universes/normalize-name';

/**
 * "Ask your collection": a question becomes a CollectionQuery (by the AI in the API, or by
 * parseQuestionLocally without it), and runCollectionQuery answers it from the user's own
 * items. The model never sees the collection and can't make items up: it only fills in this
 * shape, which is validated before use.
 */

const isoDate = z.iso.date(); // YYYY-MM-DD

export const QUERY_SCOPES = ['collection', 'preorders'] as const;
export type QueryScope = (typeof QUERY_SCOPES)[number];

export const collectionQuerySchema = z.object({
  /**
   * What the question is about: owned items, or open pre-orders (what's on order). The
   * universe, character, category, title and creator filters work on both; "added" means
   * pre-ordered for pre-orders.
   */
  scope: z.enum(QUERY_SCOPES).default('collection'),
  /** Universe slugs ("star-wars"); an item matches if it's in any of them. */
  universes: z.array(z.string()).default([]),
  /** Characters by slug; an item matches if it features any of them. */
  characters: z.array(z.object({ universe: z.string(), character: z.string() })).default([]),
  /** Categories; an item matches if it's in any of them. */
  categories: z.array(z.enum(CATEGORIES)).default([]),
  /** Words that must all appear in the title or subtitle ("way of kings"). */
  titleWords: z.array(z.string()).default([]),
  /** A name that must appear among the authors ("Sanderson"). */
  creator: z.string().exactOptional(),
  /** Added on or after this day (UTC). */
  addedAfter: isoDate.exactOptional(),
  /** Added before this day (UTC), exclusive. */
  addedBefore: isoDate.exactOptional(),
  /**
   * Pre-orders only: expected to arrive on or after this day, and before `arrivingBefore`
   * (exclusive), judged by the end of the expected period ("March 2027" arrives by March 31).
   */
  arrivingAfter: isoDate.exactOptional(),
  arrivingBefore: isoDate.exactOptional(),
  /** Pre-orders only: just those with part of the price still to pay. */
  balanceDue: z.boolean().default(false),
  /** Pre-orders only: just those whose expected date has moved later. */
  delayed: z.boolean().default(false),
  /** "recent": newest first (pre-orders: soonest expected first); "title": A to Z. */
  sort: z.enum(['recent', 'title']).default('recent'),
  /** A list of the items, or just how many there are. */
  answer: z.enum(['list', 'count']).default('list'),
  /**
   * Set when the question can't be answered with these filters ("Which volumes am I missing?"
   * needs series data; "What's it worth?" needs prices), saying why.
   */
  unsupported: z.string().exactOptional(),
});
export type CollectionQuery = z.infer<typeof collectionQuerySchema>;
export type CollectionQueryInput = z.input<typeof collectionQuerySchema>;

/** A query with every default filled in. */
export function collectionQuery(input: CollectionQueryInput = {}): CollectionQuery {
  return collectionQuerySchema.parse(input);
}

/**
 * What a query looks at in an item. The app derives it from a CollectionItem
 * (`queryableItem`); the API builds it straight from database rows.
 */
export type QueryableItem = {
  /** What the user sees (their correction, if any). */
  category: Category;
  /** ISO timestamp. */
  addedAt: string;
  /** Title and subtitle ("Batman: Year One"). */
  title: string;
  creators: readonly string[];
  /** Links as the user sees them (automatic plus their fixes). */
  universes: readonly string[];
  characters: readonly CharacterRef[];
};

export function queryableItem(item: CollectionItem): QueryableItem {
  return {
    category: item.category,
    addedAt: item.addedAt,
    title: formatTitle(item.catalog),
    creators:
      item.category === 'lego'
        ? []
        : item.category === 'figure'
          ? [item.catalog.brand ?? ''].filter(Boolean)
          : item.catalog.authors,
    ...itemLinks(item),
  };
}

export type QueryResult<T = CollectionItem> = {
  /** Matching items, sorted as asked. */
  items: T[];
  categoryCounts: Partial<Record<Category, number>>;
  /** Pre-orders only: what's still owed on the matches, per currency (minor units). */
  owed?: Partial<Record<Currency, number>>;
};

/** Whether an item (or a pre-order's item) passes the filters both scopes share. */
export function matchesItem(item: QueryableItem, query: CollectionQuery): boolean {
  if (query.categories.length > 0 && !query.categories.includes(item.category)) return false;

  if (
    query.universes.length > 0 &&
    !query.universes.some((slug) => item.universes.includes(slug))
  ) {
    return false;
  }
  if (
    query.characters.length > 0 &&
    !query.characters.some((wanted) =>
      item.characters.some(
        (ref) => ref.universe === wanted.universe && ref.character === wanted.character,
      ),
    )
  ) {
    return false;
  }

  if (query.titleWords.length > 0) {
    const title = normalizeText(item.title);
    const words = query.titleWords
      .flatMap((word) => normalizeText(word).split(' '))
      .filter(Boolean);
    if (!words.every((word) => containsPhrase(title, word))) return false;
  }
  if (query.creator !== undefined) {
    const wanted = normalizeText(query.creator);
    if (!wanted || !item.creators.some((name) => containsPhrase(normalizeText(name), wanted))) {
      return false;
    }
  }

  const day = item.addedAt.slice(0, 10);
  if (query.addedAfter !== undefined && day < query.addedAfter) return false;
  if (query.addedBefore !== undefined && day >= query.addedBefore) return false;
  return true;
}

/**
 * Answers a query from the collection: within a filter any value matches, across filters all
 * must. Items are CollectionItems, or anything with a `view` that describes them.
 */
export function runCollectionQuery(
  items: readonly CollectionItem[],
  query: CollectionQuery,
): QueryResult;
export function runCollectionQuery<T>(
  items: readonly T[],
  query: CollectionQuery,
  view: (item: T) => QueryableItem,
): QueryResult<T>;
export function runCollectionQuery<T>(
  items: readonly T[],
  query: CollectionQuery,
  view: (item: T) => QueryableItem = queryableItem as unknown as (item: T) => QueryableItem,
): QueryResult<T> {
  const found = items
    .map((item) => ({ item, seen: view(item) }))
    .filter(({ seen }) => matchesItem(seen, query));
  found.sort((a, b) =>
    query.sort === 'title'
      ? compareTitles(a.seen.title, b.seen.title)
      : b.seen.addedAt.localeCompare(a.seen.addedAt),
  );
  const categoryCounts: QueryResult['categoryCounts'] = {};
  for (const { seen } of found) {
    categoryCounts[seen.category] = (categoryCounts[seen.category] ?? 0) + 1;
  }
  return { items: found.map(({ item }) => item), categoryCounts };
}
