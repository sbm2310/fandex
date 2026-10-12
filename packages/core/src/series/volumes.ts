import type { Category } from '../category';
import { normalizeName } from '../universes/normalize-name';

/**
 * Manga and comic volumes, read from titles. Wikidata knows novel series but not manga
 * volumes, and the number is in the title anyway, in a few shapes (real Open Library titles):
 * "One Piece, Vol. 24: People's Dreams", "Hunter × Hunter, Volume 7", "New Avengers Vol. 4",
 * "Batman (2025-) #5", "ONE PIECE 113" (manga only), or a subtitle "Volume 6 (…)". Parsing is
 * conservative: a title it doesn't recognise is a standalone book, never an invented gap.
 */

export type VolumeCategory = Extract<Category, 'manga' | 'comic'>;

export type ParsedVolume = {
  /** The series as titled ("One Piece"), for display. */
  series: string;
  /** Normalized series, for grouping ("ONE PIECE" and "One Piece" are one series). */
  key: string;
  volume: number;
};

/** Highest plausible volume number (Detective Conan is past 100; 4 digits are years). */
const MAX_VOLUME = 999;

/** "Vol. 24", "Volume 7", "Vol 3", "#5" (whatever follows, like ": People's Dreams"). */
const NAMED = /^(.+?)[\s,:–-]*(?:\bvol(?:ume)?\.?|#)\s*(\d{1,3})(?!\d)/i;
/** "ONE PIECE 113", "葬送のフリーレン 15", "Chainsaw Man 22" (manga only). */
const TRAILING = /^(.+?\S)\s+(\d{1,3})$/;
/** A subtitle that is only the volume: "Volume 6 (Oyayubihime Infinity)". */
const SUBTITLE = /^(?:vol(?:ume)?\.?|#)\s*(\d{1,3})(?!\d)/i;
/** Collections of several volumes ("Vol. 19-24", "Box Set", "6 Books Collection"). */
const BUNDLE = /\d\s*[-–]\s*\d|\bbox(ed)?\s*set\b|\bbooks?\s+collection\b|\bcollection\s+set\b/i;

function seriesName(raw: string): string {
  return raw.replace(/[\s,:;–-]+$/, '').trim();
}

/** Normalized for grouping; titles in other scripts keep their characters. */
function seriesKey(series: string): string {
  // Without a leading "the": "The New Avengers" and "New Avengers" are one series.
  const latin = normalizeName(series.replace(/×/g, 'x'));
  return latin || series.toLowerCase().replace(/\s+/g, ' ').trim();
}

function volume(series: string, number: string): ParsedVolume | null {
  const name = seriesName(series);
  const value = Number(number);
  if (!name || !/\p{L}/u.test(name) || value < 1 || value > MAX_VOLUME) return null;
  return { series: name, key: seriesKey(name), volume: value };
}

/** The series and volume number of a manga or comic, or null for anything else. */
export function parseVolume(entry: {
  category: Category;
  title: string;
  subtitle?: string | undefined;
}): ParsedVolume | null {
  if (entry.category !== 'manga' && entry.category !== 'comic') return null;
  const title = entry.title.replace(/\s+/g, ' ').trim();
  const subtitle = entry.subtitle?.replace(/\s+/g, ' ').trim();
  if (BUNDLE.test(title) || (subtitle && BUNDLE.test(subtitle))) return null;

  const named = NAMED.exec(title);
  if (named) return volume(named[1]!, named[2]!);

  const fromSubtitle = subtitle ? SUBTITLE.exec(subtitle) : null;
  if (fromSubtitle) return volume(title, fromSubtitle[1]!);

  // A bare trailing number is a volume for manga; for comics it's usually part of the name
  // ("Spider-Man 2099", "Comic Reader 3").
  const trailing = entry.category === 'manga' ? TRAILING.exec(title) : null;
  return trailing ? volume(trailing[1]!, trailing[2]!) : null;
}

export type SeriesVolumes<T> = {
  key: string;
  /** The most common spelling among the owned volumes ("One Piece" over "ONE PIECE"). */
  name: string;
  category: VolumeCategory;
  /** Owned volume numbers, ascending, each once. */
  owned: number[];
  /** Volumes from 1 to the highest owned that aren't owned, ascending. */
  missing: number[];
  highest: number;
  /** The owned items, by volume number (several copies of one volume are possible). */
  items: Map<number, T[]>;
};

/**
 * Groups owned manga and comics into series by their parsed volumes and lists what's missing
 * from 1 to the highest owned volume. Series are sorted by name; a manga and a comic of the
 * same name stay separate.
 */
export function volumeGaps<
  T extends { category: Category; title: string; subtitle?: string | undefined },
>(items: readonly T[]): SeriesVolumes<T>[] {
  const groups = new Map<
    string,
    { category: VolumeCategory; names: Map<string, number>; items: Map<number, T[]> }
  >();
  for (const item of items) {
    const parsed = parseVolume(item);
    if (!parsed) continue;
    const category = item.category as VolumeCategory;
    const id = `${category}:${parsed.key}`;
    const group = groups.get(id) ?? { category, names: new Map(), items: new Map() };
    group.names.set(parsed.series, (group.names.get(parsed.series) ?? 0) + 1);
    group.items.set(parsed.volume, [...(group.items.get(parsed.volume) ?? []), item]);
    groups.set(id, group);
  }

  return [...groups.entries()]
    .map(([id, group]) => {
      const owned = [...group.items.keys()].sort((a, b) => a - b);
      const highest = owned[owned.length - 1]!;
      const have = new Set(owned);
      const missing: number[] = [];
      for (let n = 1; n <= highest; n += 1) if (!have.has(n)) missing.push(n);
      return {
        key: id.slice(id.indexOf(':') + 1),
        name: preferredName(group.names),
        category: group.category,
        owned,
        missing,
        highest,
        items: group.items,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name) || a.category.localeCompare(b.category));
}

/** The spelling used most, preferring one that isn't all capitals ("One Piece", not "ONE PIECE"). */
function preferredName(names: Map<string, number>): string {
  const shouting = (name: string) => name === name.toUpperCase() && /\p{Lu}/u.test(name);
  return [...names.entries()].sort(
    ([a, countA], [b, countB]) =>
      Number(shouting(a)) - Number(shouting(b)) || countB - countA || a.localeCompare(b),
  )[0]![0];
}

/** "1–3, 5 and 7–112": volume numbers as ranges, for "You're missing volumes …". */
export function formatVolumeRanges(numbers: readonly number[]): string {
  const sorted = [...new Set(numbers)].sort((a, b) => a - b);
  const ranges: string[] = [];
  for (let i = 0; i < sorted.length;) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j]! + 1) j += 1;
    ranges.push(j > i ? `${sorted[i]}–${sorted[j]}` : String(sorted[i]));
    i = j + 1;
  }
  return ranges.length <= 1
    ? (ranges[0] ?? '')
    : `${ranges.slice(0, -1).join(', ')} and ${ranges[ranges.length - 1]}`;
}
