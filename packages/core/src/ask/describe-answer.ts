import { CATEGORIES, type Category } from '../category';
import { CURRENCIES, formatMoney, type Currency } from '../preorders/money';
import type { SeriesStatus } from '../series/series-status';
import { formatVolumeRanges } from '../series/volumes';
import type { UniverseDirectory } from '../universes/summarize-collection';

import type { CollectionQuery, QueryResult } from './collection-query';

/** "1 comic", "8 comics", "4 LEGO sets". */
const NOUNS: Record<Category, [singular: string, plural: string]> = {
  book: ['book', 'books'],
  manga: ['manga volume', 'manga volumes'],
  comic: ['comic', 'comics'],
  lego: ['LEGO set', 'LEGO sets'],
  figure: ['figure', 'figures'],
};

function count(n: number, [singular, plural]: [string, string]): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/** "a, b and c" (or "a, b or c"). */
function and(parts: readonly string[], word = 'and'): string {
  return parts.length <= 1
    ? (parts[0] ?? '')
    : `${parts.slice(0, -1).join(', ')} ${word} ${parts[parts.length - 1]}`;
}

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});
const formatDay = (day: string, offsetDays = 0) =>
  DATE_FORMAT.format(new Date(Date.parse(`${day}T00:00:00Z`) + offsetDays * 86_400_000));

/** "Batman", "Darth Vader or Han Solo": characters first, then universes they don't imply. */
function subject(query: CollectionQuery, directory: UniverseDirectory): string {
  const characters = query.characters.flatMap((ref) => {
    const name = directory
      .find((universe) => universe.slug === ref.universe)
      ?.characters.find((character) => character.slug === ref.character)?.name;
    return name ? [name] : [];
  });
  const universes = query.universes
    .filter((slug) => !query.characters.some((ref) => ref.universe === slug))
    .flatMap((slug) => {
      const name = directory.find((universe) => universe.slug === slug)?.name;
      return name ? [name] : [];
    });
  // Any of them matches, so "or".
  return and([...characters, ...universes], 'or');
}

/** What the items are called: one category's noun, "manga volumes and comics", or "items". */
function nouns(categories: readonly Category[]): [string, string] {
  const [only] = categories;
  if (categories.length === 1 && only) return NOUNS[only];
  if (categories.length === 0) return ['item', 'items'];
  const joined = and(categories.map((category) => NOUNS[category][1]));
  return [joined, joined];
}

/** "added since October 1, 2026", "pre-ordered from … to …" (`before` is exclusive). */
function addedPhrase(verb: string, after?: string, before?: string): string | undefined {
  if (after && before) {
    // The end is exclusive: name the last day included.
    const first = formatDay(after);
    const last = formatDay(before, -1);
    return first === last ? `${verb} on ${first}` : `${verb} from ${first} to ${last}`;
  }
  if (after) return `${verb} since ${formatDay(after)}`;
  if (before) return `${verb} before ${formatDay(before)}`;
  return undefined;
}

const MONTH_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** "arriving in October 2026", "arriving from … to …", "arriving before …". */
function arrivingPhrase(after?: string, before?: string): string | undefined {
  if (after && before) {
    const next = new Date(`${after}T00:00:00Z`);
    next.setUTCMonth(next.getUTCMonth() + 1);
    const wholeMonth = after.endsWith('-01') && next.toISOString().slice(0, 10) === before;
    if (wholeMonth) return `arriving in ${MONTH_FORMAT.format(new Date(`${after}T00:00:00Z`))}`;
    return `arriving from ${formatDay(after)} to ${formatDay(before, -1)}`;
  }
  if (after) return `arriving from ${formatDay(after)} on`;
  if (before) return `arriving before ${formatDay(before)}`;
  return undefined;
}

/** The filters after the noun: "by …", "with “…” in the title". */
function itemFilters(query: CollectionQuery): string[] {
  const parts: string[] = [];
  if (query.creator) parts.push(`by ${query.creator}`);
  if (query.titleWords.length > 0) parts.push(`with “${query.titleWords.join(' ')}” in the title`);
  return parts;
}

/** The words after the number: "Star Wars LEGO sets by … added since October 1, 2026". */
function description(query: CollectionQuery, directory: UniverseDirectory, n: number): string {
  const noun = nouns(query.categories);
  return [
    subject(query, directory),
    n === 1 ? noun[0] : noun[1],
    ...itemFilters(query),
    addedPhrase('added', query.addedAfter, query.addedBefore),
  ]
    .filter(Boolean)
    .join(' ');
}

/** A category as a pre-order's kind: "comic pre-orders", "LEGO pre-orders". */
const PREORDER_KINDS: Record<Category, string> = {
  book: 'book',
  manga: 'manga',
  comic: 'comic',
  lego: 'LEGO',
  figure: 'figure',
};

/** "delayed Batman figure pre-orders arriving in March 2027" (or "… pre-order"). */
function preorderDescription(
  query: CollectionQuery,
  directory: UniverseDirectory,
  n: number,
): string {
  return [
    query.delayed ? 'delayed' : '',
    subject(query, directory),
    and(query.categories.map((category) => PREORDER_KINDS[category])),
    n === 1 ? 'pre-order' : 'pre-orders',
    ...itemFilters(query),
    addedPhrase('ordered', query.addedAfter, query.addedBefore),
    arrivingPhrase(query.arrivingAfter, query.arrivingBefore),
  ]
    .filter(Boolean)
    .join(' ');
}

/** "$280.00", "$280.00 and €50.00" (each currency on its own: they don't add up). */
function money(owed: Partial<Record<Currency, number>>): string {
  return and(
    CURRENCIES.filter((currency) => owed[currency]).map((currency) =>
      formatMoney(owed[currency]!, currency),
    ),
  );
}

/**
 * "You have 2 pre-orders arriving in October 2026: 1 book and 1 figure. Still owed: $280.00."
 * or, when the question is what's owed, "You still owe $280.00 on 1 pre-order."
 */
function describePreorders(
  query: CollectionQuery,
  result: Pick<QueryResult<unknown>, 'items' | 'categoryCounts' | 'owed'>,
  directory: UniverseDirectory,
): string {
  const n = result.items.length;
  const owed = money(result.owed ?? {});
  if (query.balanceDue) {
    return n === 0
      ? `You don't owe anything on your ${preorderDescription(query, directory, 2)}.`
      : `You still owe ${owed} on ${n} ${preorderDescription(query, directory, n)}.`;
  }
  if (n === 0) return `You have no ${preorderDescription(query, directory, 2)}.`;

  let sentence = `You have ${n} ${preorderDescription(query, directory, n)}`;
  const kinds = CATEGORIES.filter((category) => result.categoryCounts[category]);
  if (n > 1 && kinds.length > 1 && query.categories.length !== 1) {
    sentence += `: ${and(kinds.map((category) => count(result.categoryCounts[category]!, NOUNS[category])))}`;
  }
  sentence += '.';
  if (owed) sentence += ` Still owed: ${owed}.`;
  return sentence;
}

/** "books", "volume": what a series' places are called. */
function seriesUnit(series: SeriesStatus, count: number): string {
  if (series.category === 'book') return count === 1 ? 'book' : 'books';
  return count === 1 ? 'volume' : 'volumes';
}

/** Lists at most this many series in one answer. */
const SERIES_LISTED = 5;

/**
 * "You're missing books 3–5 of The Stormlight Archive.", "You're missing something from 2 manga
 * series: One Piece (volumes 2 and 4) and Naruto (volume 5).", "You aren't missing anything…".
 */
function describeSeries(query: CollectionQuery, series: readonly SeriesStatus[]): string {
  const kind =
    query.categories.length > 0 ? `${and(query.categories.map((c) => PREORDER_KINDS[c]))} ` : '';
  const named =
    query.titleWords.length > 0 ? ` with “${query.titleWords.join(' ')}” in the name` : '';
  const n = series.length;
  if (n === 0) return `You aren't missing anything from your ${kind}series${named}.`;
  if (query.answer === 'count') {
    return `${n} of your ${kind}series${named} ${n === 1 ? 'is' : 'are'} missing something.`;
  }
  const what = (s: SeriesStatus) =>
    `${seriesUnit(s, s.missing.length)} ${formatVolumeRanges(s.missing)}`;
  if (n === 1) return `You're missing ${what(series[0]!)} of ${series[0]!.name}.`;
  const listed = series.slice(0, SERIES_LISTED).map((s) => `${s.name} (${what(s)})`);
  if (n > SERIES_LISTED) listed.push(`${n - SERIES_LISTED} more`);
  return `You're missing something from ${n} ${kind}series: ${and(listed)}.`;
}

/**
 * The answer as one or two sentences: "You own 12 Batman items: 8 comics and 4 LEGO sets.", or
 * for pre-orders "You have 2 pre-orders arriving in October 2026. Still owed: $280.00."
 * `unknown` lists universes or characters the query named that Fandex doesn't know (from
 * resolveModelQuery); they were left out, and the answer says so.
 */
export function describeAnswer(
  query: CollectionQuery,
  result: Pick<QueryResult<unknown>, 'items' | 'categoryCounts' | 'owed' | 'series'>,
  directory: UniverseDirectory,
  unknown: readonly string[] = [],
): string {
  if (query.unsupported) return `I can't answer that yet: ${query.unsupported}`;

  const n = result.items.length;
  let sentence: string;
  if (query.scope === 'series') {
    sentence = describeSeries(query, result.series ?? []);
  } else if (query.scope === 'preorders') {
    sentence = describePreorders(query, result, directory);
  } else if (n === 0) {
    sentence = `You don't own any ${description(query, directory, 2)} yet.`;
  } else {
    sentence = `You own ${n} ${description(query, directory, n)}`;
    const kinds = CATEGORIES.filter((category) => result.categoryCounts[category]);
    // A breakdown when the answer mixes categories the question didn't single out.
    if (n > 1 && kinds.length > 1 && query.categories.length !== 1) {
      sentence += `: ${and(kinds.map((category) => count(result.categoryCounts[category]!, NOUNS[category])))}`;
    }
    sentence += '.';
  }
  if (unknown.length > 0) {
    sentence += ` (Fandex doesn't know ${and(unknown.map((name) => `“${name}”`))}, so ${
      unknown.length === 1 ? 'it was' : 'they were'
    } left out.)`;
  }
  return sentence;
}
