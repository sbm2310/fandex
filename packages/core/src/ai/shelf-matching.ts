import type { Category } from '../category';
import { displaySetNumber, parseSetNumber } from '../catalog-set';

import { normalizeReading, type ShelfReading } from './shelf-reading';

/**
 * Turning what the model read into catalog entries. The model's text is a guess (often
 * misspelled, sometimes invented), so each reading is searched for in our catalogs and the
 * results are ranked; only entries whose title resembles the reading count as candidates,
 * and the user picks from them.
 */

/** The fields ranking needs; both core catalog entries and API catalog items have them. */
export type MatchableEntry = {
  title: string;
  subtitle?: string;
  creators: readonly string[];
  category: Category;
  setNumber?: string;
  year?: number;
};

/** Where readings are looked up (the API's cached catalog in production, fixtures in tests). */
export type ShelfCatalog<T extends MatchableEntry> = {
  searchBooks(query: string): Promise<T[]>;
  /** Null when LEGO isn't available on this server. */
  searchSets: ((query: string) => Promise<T[]>) | null;
  lookupSet: ((setNumber: string) => Promise<T | null>) | null;
};

export type ShelfMatch<T> = {
  reading: ShelfReading;
  /** Best first; empty when nothing resembled the reading (the user can search instead). */
  candidates: T[];
};

/** Candidates offered per reading: the best match plus a few alternatives. */
export const MAX_SHELF_CANDIDATES = 4;
/** Readings resolved per photo: each costs one or two catalog requests. */
export const MAX_SHELF_READINGS = 24;
/** Below this, an entry doesn't look like the reading at all. */
const MIN_TITLE_SIMILARITY = 0.6;

/** Words that say little about which book it is. */
const STOP_WORDS = new Set(['the', 'a', 'an', 'of', 'and', 'vol', 'volume', 'book']);

function words(value: string): string[] {
  return normalizeReading(value)
    .split(' ')
    .filter((word) => word && !STOP_WORDS.has(word));
}

/**
 * How well an entry's title matches what was read, from 0 to 1. Mostly "is everything we
 * read in the entry's title or subtitle" (a spine shows less than the full title), a little
 * "is the entry's title mostly what we read" (prefers "Civil War" to "Civil War Companion").
 */
export function titleSimilarity(
  read: string,
  entry: Pick<MatchableEntry, 'title' | 'subtitle'>,
): number {
  const readWords = new Set(words(read));
  if (readWords.size === 0) return 0;
  const titleWords = [...new Set(words(entry.title))];
  const allWords = new Set([...titleWords, ...words(entry.subtitle ?? '')]);
  const covered = [...readWords].filter((word) => allWords.has(word)).length / readWords.size;
  const focused =
    titleWords.length === 0
      ? 0
      : titleWords.filter((word) => readWords.has(word)).length / titleWords.length;
  return 0.7 * covered + 0.3 * focused;
}

/** Shares a name word (3+ letters) with any creator: "Inoue" in "井上雄彦 (Takehiko Inoue)". */
function sameAuthor(author: string, creators: readonly string[]): boolean {
  const authorWords = words(author).filter((word) => word.length >= 3);
  return creators.some((creator) => words(creator).some((word) => authorWords.includes(word)));
}

/** "Vagabond, Vol. 6" → 6, "Volume 1", "Book 3", "バガボンド(5)" → 5; undefined when unnumbered. */
export function volumeNumber(
  entry: Pick<MatchableEntry, 'title' | 'subtitle'>,
): number | undefined {
  const text = `${entry.title} ${entry.subtitle ?? ''}`;
  const match =
    /\b(?:vol(?:ume)?\.?|book|part)\s*(\d{1,3})\b/i.exec(text) ??
    /[(,]\s*(\d{1,3})\s*\)?\s*$/.exec(entry.title);
  return match ? Number(match[1]) : undefined;
}

/**
 * How likely an entry is the item read, or 0 when it can't be. The title must resemble the
 * reading; the right category (a manga reading → a manga entry) and the right author add to
 * it, and a LEGO set number read off a label is near-certain.
 */
export function scoreEntry(reading: ShelfReading, entry: MatchableEntry): number {
  if ((reading.kind === 'lego') !== (entry.category === 'lego')) return 0;
  const title = Math.max(
    titleSimilarity(reading.title, entry),
    reading.englishTitle ? titleSimilarity(reading.englishTitle, entry) : 0,
  );
  if (title < MIN_TITLE_SIMILARITY) return 0;

  let score = title;
  if (reading.kind === 'lego') {
    const setNumber = reading.setNumber && parseSetNumber(reading.setNumber);
    if (setNumber && entry.setNumber === displaySetNumber(setNumber)) score += 0.5;
    // Seven-digit numbers are promotional items and gear (key chains, polybags), rarely what
    // stands on a shelf; among similar names, newer sets are likelier.
    if (entry.setNumber && /^\d{7,}/.test(entry.setNumber)) score -= 0.15;
    if (entry.year) score += Math.max(0, entry.year - 2000) / 1000;
    return score;
  }
  if (reading.kind !== 'book') {
    if (entry.category === reading.kind) score += 0.15;
    else if (entry.category === 'book') score -= 0.1;
  }
  if (reading.author && sameAuthor(reading.author, entry.creators)) score += 0.15;
  // A run of volumes on the shelf is offered from its first volume.
  if (reading.count > 1 && volumeNumber(entry) === 1) score += 0.1;
  return score;
}

/** Entries that could be the reading, best first (ties keep the source's order). */
export function rankEntries<T extends MatchableEntry>(
  reading: ShelfReading,
  entries: readonly T[],
): T[] {
  return entries
    .map((entry, index) => ({ entry, index, score: scoreEntry(reading, entry) }))
    .filter((ranked) => ranked.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((ranked) => ranked.entry);
}

/**
 * The search for a book reading: with the author when the model read one ("Civil War" alone
 * finds Civil War history books; "Civil War Millar" finds the Marvel event), otherwise with
 * "manga" or "comics" (classified entries then rank by category). Non-English readings search
 * by their English title.
 */
export function shelfSearchQuery(reading: ShelfReading): string {
  const title = reading.englishTitle ?? reading.title;
  if (reading.kind === 'lego') return title;
  if (reading.author) return `${title} ${reading.author}`;
  if (reading.kind === 'manga') return `${title} manga`;
  if (reading.kind === 'comic') return `${title} comics`;
  return title;
}

function uniqueBy<T>(items: readonly T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const id = key(item);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

async function candidatesFor<T extends MatchableEntry>(
  reading: ShelfReading,
  catalog: ShelfCatalog<T>,
  key: (entry: T) => string,
): Promise<T[]> {
  if (reading.kind !== 'lego') {
    const query = shelfSearchQuery(reading);
    const ranked = rankEntries(reading, await catalog.searchBooks(query));
    // The extra words narrow the search, and sometimes to nothing: Open Library wants every
    // word to match ("Edge of Spider-Verse comics" finds nothing; "Edge of Spider-Verse" does).
    const plain = reading.englishTitle ?? reading.title;
    if (ranked.length > 0 || query === plain) return ranked;
    return rankEntries(reading, await catalog.searchBooks(plain));
  }
  if (!catalog.searchSets) return [];
  const found: T[] = [];
  // A set number read off a display stand or box is the best evidence, but models also
  // invent numbers ("75020" for an X-wing is Jabba's Sail Barge): it counts only if the
  // set's name resembles what was read.
  const setNumber = reading.setNumber && parseSetNumber(reading.setNumber);
  if (setNumber && catalog.lookupSet) {
    const set = await catalog.lookupSet(setNumber).catch(() => null);
    if (set) found.push(set);
  }
  found.push(...(await catalog.searchSets(shelfSearchQuery(reading))));
  return rankEntries(reading, uniqueBy(found, key));
}

/**
 * Looks up every reading (one failure doesn't sink the others: that reading just gets no
 * candidates) and drops readings whose best candidate an earlier reading already claimed
 * (the same series read twice, or a book seen in both halves of the photo).
 */
export async function matchShelfReadings<T extends MatchableEntry>(
  readings: readonly ShelfReading[],
  catalog: ShelfCatalog<T>,
  key: (entry: T) => string,
  onError: (reading: ShelfReading, error: unknown) => void = () => {},
): Promise<ShelfMatch<T>[]> {
  const matches = await Promise.all(
    readings.slice(0, MAX_SHELF_READINGS).map(async (reading) => {
      const candidates = await candidatesFor(reading, catalog, key).catch((error: unknown) => {
        onError(reading, error);
        return [];
      });
      return { reading, candidates: candidates.slice(0, MAX_SHELF_CANDIDATES) };
    }),
  );
  const claimed = new Set<string>();
  return matches.filter(({ candidates: [best] }) => {
    if (!best) return true;
    if (claimed.has(key(best))) return false;
    claimed.add(key(best));
    return true;
  });
}
