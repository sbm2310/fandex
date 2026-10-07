import { normalizeReading, type ShelfItemKind, type ShelfReading } from './shelf-reading';

/**
 * Scoring a shelf reading against what is really on the shelf: the measure behind the
 * evaluation script (like a test suite that reports a percentage instead of pass/fail).
 */

/** Something that is really on the shelf, as a person listed it. */
export type ExpectedShelfItem = {
  id: string;
  kind: ShelfItemKind;
  /** Display name, e.g. "Vinland Saga (deluxe, Kodansha)". */
  name: string;
  /**
   * Phrases that identify it in a reading's title or English title: titles of the volumes,
   * the series, and (when the spine shows little else) the author. Any script.
   */
  aliases: readonly string[];
  /** Spines (a series run is one item with its volume count). */
  count: number;
  /** LEGO set number, matched exactly when the model reads one. */
  setNumber?: string;
};

export type ShelfScore = {
  /** Expected items at least one reading identified. */
  found: string[];
  missed: string[];
  /** Readings that match nothing on the shelf: misreadings or inventions. */
  unmatched: ShelfReading[];
  matches: { itemId: string; reading: ShelfReading }[];
  /** found / expected. */
  recall: number;
  /** matched readings / readings. */
  precision: number;
};

/** Shorter readings ("War") would match far too much. */
const MIN_PARTIAL_LENGTH = 5;

function phraseIn(text: string, phrase: string): boolean {
  return phrase.length > 0 && ` ${text} `.includes(` ${phrase} `);
}

/**
 * A reading matches an item when an alias appears in its title, or its whole title appears in
 * an alias (models shorten: "Big Time" for "Spider-Man: Big Time"). The printed title is
 * tried against every item before the English title, so a Hebrew "הארי פוטר" goes to the
 * Hebrew edition and an English "Harry Potter" to the English box set.
 */
function matchItem(
  reading: ShelfReading,
  items: readonly ExpectedShelfItem[],
): ExpectedShelfItem | undefined {
  // Book, manga and comic blur together on a shelf (a manga omnibus, a graphic novel).
  const candidates = items.filter((item) => (item.kind === 'lego') === (reading.kind === 'lego'));
  const setNumber = reading.setNumber;
  if (setNumber) {
    const bySet = candidates.find(
      (item) => item.setNumber && setBase(item.setNumber) === setBase(setNumber),
    );
    if (bySet) return bySet;
  }
  for (const text of [reading.title, reading.englishTitle]) {
    if (!text) continue;
    const normalized = normalizeReading(text);
    const hit = candidates.find((item) =>
      item.aliases.some((alias) => {
        const phrase = normalizeReading(alias);
        return (
          phraseIn(normalized, phrase) ||
          (normalized.length >= MIN_PARTIAL_LENGTH && phraseIn(phrase, normalized))
        );
      }),
    );
    if (hit) return hit;
  }
  return undefined;
}

function setBase(setNumber: string): string {
  return setNumber.replace(/-\d+$/, '');
}

export function scoreShelfReading(
  expected: readonly ExpectedShelfItem[],
  readings: readonly ShelfReading[],
): ShelfScore {
  const matches: ShelfScore['matches'] = [];
  const unmatched: ShelfReading[] = [];
  for (const reading of readings) {
    const item = matchItem(reading, expected);
    if (item) matches.push({ itemId: item.id, reading });
    else unmatched.push(reading);
  }
  const foundIds = new Set(matches.map((match) => match.itemId));
  const found = expected.filter((item) => foundIds.has(item.id)).map((item) => item.id);
  const missed = expected.filter((item) => !foundIds.has(item.id)).map((item) => item.id);
  return {
    found,
    missed,
    unmatched,
    matches,
    recall: expected.length === 0 ? 1 : found.length / expected.length,
    precision: readings.length === 0 ? 1 : matches.length / readings.length,
  };
}
