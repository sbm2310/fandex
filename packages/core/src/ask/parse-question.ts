import type { Category } from '../category';
import type { CharacterRef } from '../universes/match-universes';
import { containsPhrase, normalizeName, normalizeText } from '../universes/normalize-name';
import { UNIVERSE_SEED, type UniverseSeed } from '../universes/universe-seed';

import { collectionQuery, type CollectionQuery } from './collection-query';

/**
 * The keyword fallback for when the AI isn't available (no key, the daily allowance used up,
 * the provider down): finds universe, character and category names in the question, "how
 * many", a few date phrases, and questions Fandex can't answer yet. Anything subtler needs
 * the model.
 */

/** Other ways people name a universe in a question (on top of its name and title aliases). */
const QUESTION_ALIASES: Record<string, string[]> = {
  'middle-earth': ['Tolkien', 'LOTR'],
  'wizarding-world': ['Hogwarts'],
  dc: ['DC Comics'],
};

const CATEGORY_WORDS: [Category, string[]][] = [
  ['book', ['book', 'books', 'novel', 'novels']],
  ['manga', ['manga', 'mangas']],
  ['comic', ['comic', 'comics', 'graphic novel', 'graphic novels', 'trade paperbacks']],
  ['lego', ['lego', 'legos', 'lego set', 'lego sets', 'sets']],
];

/** Questions that need data Fandex doesn't have yet, and why. */
const UNSUPPORTED: [string[], string][] = [
  [
    ['missing', 'gaps', 'complete the series', 'next volume'],
    "Fandex doesn't know which volumes a series has yet, so it can't tell what's missing.",
  ],
  [
    [
      'pre order',
      'preorder',
      'pre ordered',
      'preordered',
      'arriving',
      'release',
      'releases',
      'coming out',
    ],
    "pre-orders and release dates aren't tracked yet.",
  ],
  [
    ['worth', 'value', 'price', 'prices', 'cost', 'paid', 'spent'],
    "Fandex doesn't track prices or values.",
  ],
];

/** One-word character names that are everyday words in a question ("my child's books"). */
const COMMON_WORDS = new Set(['child', 'merry']);

const ALL_ITEMS = ['everything', 'my collection', 'what do i own', 'what do i have', 'all my'];

function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dateRange(text: string, today: Date): Pick<CollectionQuery, 'addedAfter' | 'addedBefore'> {
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  const d = today.getUTCDate();
  const day = (year: number, month: number, date = 1) =>
    utcDay(new Date(Date.UTC(year, month, date)));
  if (containsPhrase(text, 'today')) return { addedAfter: day(y, m, d) };
  if (containsPhrase(text, 'this week')) {
    const monday = d - ((today.getUTCDay() + 6) % 7);
    return { addedAfter: day(y, m, monday) };
  }
  if (containsPhrase(text, 'this month')) return { addedAfter: day(y, m) };
  if (containsPhrase(text, 'last month'))
    return { addedAfter: day(y, m - 1), addedBefore: day(y, m) };
  if (containsPhrase(text, 'this year')) return { addedAfter: day(y, 0) };
  if (containsPhrase(text, 'last year'))
    return { addedAfter: day(y - 1, 0), addedBefore: day(y, 0) };
  if (containsPhrase(text, 'recently') || containsPhrase(text, 'lately')) {
    return { addedAfter: day(y, m, d - 30) };
  }
  return {};
}

/** Every normalized name a character answers to in a question. */
function characterNames(universe: UniverseSeed): { ref: CharacterRef; names: string[] }[] {
  return universe.characters.map((character) => ({
    ref: { universe: universe.slug, character: character.slug },
    names: [character.name, ...(character.aliases ?? []), ...(character.titleNames ?? [])]
      .map(normalizeName)
      .filter((name) => !COMMON_WORDS.has(name)),
  }));
}

/** Blanks out a matched phrase so its words can't match again ("Harry Potter" the universe). */
function without(text: string, phrase: string): string {
  return ` ${text} `.replace(` ${phrase} `, ' ').trim();
}

export function parseQuestionLocally(
  question: string,
  {
    seed = UNIVERSE_SEED,
    today = new Date(),
  }: { seed?: readonly UniverseSeed[]; today?: Date } = {},
): CollectionQuery {
  let text = normalizeText(question);

  for (const [phrases, reason] of UNSUPPORTED) {
    if (phrases.some((phrase) => containsPhrase(text, normalizeText(phrase)))) {
      return collectionQuery({ unsupported: reason });
    }
  }

  // Universes first, longest phrases first, so "Harry Potter books" is the Wizarding World
  // (not the character) and "Star Wars" isn't read again as anything else.
  const universes: string[] = [];
  const universePhrases = seed
    .flatMap((universe) =>
      [universe.name, ...universe.titleAliases, ...(QUESTION_ALIASES[universe.slug] ?? [])].map(
        (phrase) => ({ slug: universe.slug, phrase: normalizeName(phrase) }),
      ),
    )
    .sort((a, b) => b.phrase.length - a.phrase.length);
  for (const { slug, phrase } of universePhrases) {
    if (phrase && containsPhrase(text, phrase)) {
      if (!universes.includes(slug)) universes.push(slug);
      text = without(text, phrase);
    }
  }

  // Then characters, by any of their names; a name two universes share is skipped.
  const candidates = seed.flatMap(characterNames);
  const characters: CharacterRef[] = [];
  for (const { ref, names } of candidates) {
    const said = names.find((name) => name && containsPhrase(text, name));
    if (!said) continue;
    const shared = candidates.some(
      (other) => other.ref.universe !== ref.universe && other.names.includes(said),
    );
    if (!shared) characters.push(ref);
  }

  // Longest phrases first, removed once matched: "graphic novels" are comics, not novels.
  const categories: Category[] = [];
  const categoryPhrases = CATEGORY_WORDS.flatMap(([category, words]) =>
    words.map((phrase) => ({ category, phrase })),
  ).sort((a, b) => b.phrase.length - a.phrase.length);
  for (const { category, phrase } of categoryPhrases) {
    if (containsPhrase(text, phrase)) {
      if (!categories.includes(category)) categories.push(category);
      text = without(text, phrase);
    }
  }

  const dates = dateRange(text, today);
  const counting = containsPhrase(text, 'how many') || containsPhrase(text, 'number of');
  const recognized =
    universes.length > 0 ||
    characters.length > 0 ||
    categories.length > 0 ||
    Object.keys(dates).length > 0;
  if (!recognized && !counting && !ALL_ITEMS.some((phrase) => containsPhrase(text, phrase))) {
    return collectionQuery({
      unsupported:
        "I couldn't tell what to look for. Try naming a universe, a character or a category, like “How many Star Wars LEGO sets do I have?”",
    });
  }

  return collectionQuery({
    // A character already says which universe it's from.
    universes: universes.filter((slug) => !characters.some((ref) => ref.universe === slug)),
    characters,
    categories,
    ...dates,
    sort:
      containsPhrase(text, 'alphabetical') || containsPhrase(text, 'a to z') ? 'title' : 'recent',
    answer: counting ? 'count' : 'list',
  });
}
