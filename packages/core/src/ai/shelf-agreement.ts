import { titleWords } from './shelf-matching';
import type { ShelfReading } from './shelf-reading';

/**
 * Two readings of the same photo, compared. The model invents plausible titles after the real
 * ones ("Spider-Man: Gold" on a shelf of Spider-Man trades), but the inventions change from one
 * reading to the next while real titles come back (measured in docs/eval/shelf-recognition.md).
 * So a title both readings found is likely on the shelf; one only a single reading found may
 * not be. Nothing is dropped: the app ticks the sure ones and lists the rest as less sure.
 */

export type CombinedShelfReading = ShelfReading & {
  /** Found by both readings. */
  sure: boolean;
};

/**
 * Shared words over all words, so a shared series name isn't enough ("Spider-Man: Gold" vs
 * "Spider-Man: Red" is 2/4).
 */
const MIN_AGREEMENT = 0.6;

function wordSets(reading: ShelfReading): Set<string>[] {
  return [reading.title, reading.englishTitle]
    .filter((title): title is string => !!title)
    .map((title) => new Set(titleWords(title)))
    .filter((words) => words.size > 0);
}

function agreement(left: Set<string>, right: Set<string>): number {
  const shared = [...left].filter((word) => right.has(word)).length;
  const [smaller, larger] = left.size <= right.size ? [left, right] : [right, left];
  // A title of two or more words read whole inside the other: the model sometimes adds a
  // series or publisher ("Civil War" / "X-Men: Civil War").
  if (smaller.size >= 2 && shared === smaller.size && larger.size <= smaller.size + 2) return 1;
  return shared / (left.size + right.size - shared);
}

/** How much two readings look like the same item, from 0 to 1 (either title, as printed or in English). */
export function readingAgreement(a: ShelfReading, b: ShelfReading): number {
  let best = 0;
  for (const left of wordSets(a)) {
    for (const right of wordSets(b)) best = Math.max(best, agreement(left, right));
  }
  return best;
}

/**
 * Pairs the readings of two passes over one photo (each reading pairs at most once, with its
 * closest match). Paired readings come first, in the first pass's order, merged (the larger
 * count, details either pass read); then the first pass's unpaired readings, then the second's.
 */
export function combineShelfReadings(
  first: readonly ShelfReading[],
  second: readonly ShelfReading[],
): CombinedShelfReading[] {
  const unpaired = new Set(second);
  const sure: CombinedShelfReading[] = [];
  const unsure: CombinedShelfReading[] = [];

  for (const reading of first) {
    let match: ShelfReading | undefined;
    let matchScore = MIN_AGREEMENT;
    for (const other of unpaired) {
      const score = readingAgreement(reading, other);
      if (score >= matchScore) {
        match = other;
        matchScore = score;
      }
    }
    if (!match) {
      unsure.push({ ...reading, sure: false });
      continue;
    }
    unpaired.delete(match);
    // The first pass's text, plus anything only the second read (an author, a set number).
    sure.push({ ...match, ...reading, count: Math.max(reading.count, match.count), sure: true });
  }
  return [...sure, ...unsure, ...[...unpaired].map((reading) => ({ ...reading, sure: false }))];
}
