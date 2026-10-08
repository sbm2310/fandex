import { CATEGORIES, type Category } from '../category';
import type { UniverseDirectory } from '../universes/summarize-collection';

import type { CollectionQuery, QueryResult } from './collection-query';

/** "1 comic", "8 comics", "4 LEGO sets". */
const NOUNS: Record<Category, [singular: string, plural: string]> = {
  book: ['book', 'books'],
  manga: ['manga volume', 'manga volumes'],
  comic: ['comic', 'comics'],
  lego: ['LEGO set', 'LEGO sets'],
};

function count(n: number, [singular, plural]: [string, string]): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/** "a, b and c". */
function and(parts: readonly string[]): string {
  return parts.length <= 1
    ? (parts[0] ?? '')
    : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});
const formatDay = (day: string) => DATE_FORMAT.format(new Date(`${day}T00:00:00Z`));

/** "Batman", "Star Wars and Middle-earth": characters first, then universes they don't imply. */
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
  return and([...characters, ...universes]);
}

/** What the items are called: one category's noun, "manga volumes and comics", or "items". */
function nouns(categories: readonly Category[]): [string, string] {
  const [only] = categories;
  if (categories.length === 1 && only) return NOUNS[only];
  if (categories.length === 0) return ['item', 'items'];
  const joined = and(categories.map((category) => NOUNS[category][1]));
  return [joined, joined];
}

/** The words after the number: "Star Wars LEGO sets by … added since October 1, 2026". */
function description(query: CollectionQuery, directory: UniverseDirectory, n: number): string {
  const noun = nouns(query.categories);
  const parts = [subject(query, directory), n === 1 ? noun[0] : noun[1]];
  if (query.creator) parts.push(`by ${query.creator}`);
  if (query.titleWords.length > 0) parts.push(`with “${query.titleWords.join(' ')}” in the title`);
  if (query.addedAfter && query.addedBefore) {
    parts.push(`added from ${formatDay(query.addedAfter)} until ${formatDay(query.addedBefore)}`);
  } else if (query.addedAfter) {
    parts.push(`added since ${formatDay(query.addedAfter)}`);
  } else if (query.addedBefore) {
    parts.push(`added before ${formatDay(query.addedBefore)}`);
  }
  return parts.filter(Boolean).join(' ');
}

/**
 * The answer as one or two sentences: "You own 12 Batman items: 8 comics and 4 LEGO sets."
 * `unknown` lists universes or characters the query named that Fandex doesn't know (from
 * checkQuery); they were left out, and the answer says so.
 */
export function describeAnswer(
  query: CollectionQuery,
  result: QueryResult,
  directory: UniverseDirectory,
  unknown: readonly string[] = [],
): string {
  if (query.unsupported) return `I can't answer that yet: ${query.unsupported}`;

  const n = result.items.length;
  let sentence: string;
  if (n === 0) {
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
