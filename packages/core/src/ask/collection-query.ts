import { z } from 'zod';

import { formatTitle } from '../catalog-book';
import { CATEGORIES, type Category } from '../category';
import { itemLinks, type CollectionItem } from '../collection-item';
import { compareTitles } from '../sort-collection';
import type { CharacterRef } from '../universes/match-universes';
import type { UniverseDirectory } from '../universes/summarize-collection';
import { containsPhrase, normalizeText } from '../universes/normalize-name';

/**
 * "Ask your collection": a question becomes a CollectionQuery (by the AI in the API, or by
 * parseQuestionLocally without it), and runCollectionQuery answers it from the user's own
 * items. The model never sees the collection and can't make items up: it only fills in this
 * shape, which is validated before use.
 */

const isoDate = z.iso.date(); // YYYY-MM-DD

export const collectionQuerySchema = z.object({
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
  sort: z.enum(['recent', 'title']).default('recent'),
  /** A list of the items, or just how many there are. */
  answer: z.enum(['list', 'count']).default('list'),
  /**
   * Set when the question can't be answered from the collection with these filters ("Which
   * volumes am I missing?" needs series data; "What's arriving?" needs pre-orders), saying why.
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
    creators: item.category === 'lego' ? [] : item.catalog.authors,
    ...itemLinks(item),
  };
}

export type QueryResult<T = CollectionItem> = {
  /** Matching items, sorted as asked. */
  items: T[];
  categoryCounts: Partial<Record<Category, number>>;
};

/**
 * Drops universes and characters the directory doesn't know (a model may invent a slug such
 * as "batman-universe"), so an answer is never "you own nothing" because of a typo. Returns
 * what was dropped, for the answer to mention.
 */
export function checkQuery(
  query: CollectionQuery,
  directory: UniverseDirectory,
): { query: CollectionQuery; unknown: string[] } {
  const unknown: string[] = [];
  const universes = query.universes.filter((slug) => {
    const known = directory.some((universe) => universe.slug === slug);
    if (!known) unknown.push(slug);
    return known;
  });
  const characters = query.characters.filter((ref) => {
    const known = directory
      .find((universe) => universe.slug === ref.universe)
      ?.characters.some((character) => character.slug === ref.character);
    if (!known) unknown.push(`${ref.universe}/${ref.character}`);
    return known;
  });
  return { query: { ...query, universes, characters }, unknown };
}

function matches(item: QueryableItem, query: CollectionQuery): boolean {
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
    .filter(({ seen }) => matches(seen, query));
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
