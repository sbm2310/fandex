import type { Category } from '../category';
import type { CharacterRef } from '../universes/match-universes';
import { containsPhrase, normalizeName, normalizeText } from '../universes/normalize-name';
import { UNIVERSE_SEED, type UniverseSeed } from '../universes/universe-seed';

import { collectionQuery, type CollectionQuery } from './collection-query';

/**
 * The keyword fallback for when the AI isn't available (no key, the daily allowance used up,
 * the provider down): finds universe, character and category names in the question, "how
 * many", a few date phrases, pre-order questions (arriving, owed, delayed), and questions
 * Fandex can't answer yet. Anything subtler needs the model.
 */

/** Other ways people name a universe in a question (on top of its name and title aliases). */
const QUESTION_ALIASES: Record<string, string[]> = {
  'middle-earth': ['Tolkien', 'LOTR'],
  'wizarding-world': ['Hogwarts'],
  dc: ['DC Comics'],
  // Not "GoT": in a question it's the word "got". Not "Sanderson": he writes more than Cosmere.
  'a-song-of-ice-and-fire': ['ASOIAF'],
  cosmere: ['Stormlight'],
  'jurassic-park': ['Jurassic'],
  // Safe in a question, never when matching items (Disney publishes Star Wars and Marvel).
  'disney-pixar': ['Disney', 'Pixar'],
};

const CATEGORY_WORDS: [Category, string[]][] = [
  ['book', ['book', 'books', 'novel', 'novels']],
  ['manga', ['manga', 'mangas']],
  ['comic', ['comic', 'comics', 'graphic novel', 'graphic novels', 'trade paperbacks']],
  ['lego', ['lego', 'legos', 'lego set', 'lego sets', 'sets']],
  ['figure', ['figure', 'figures', 'statue', 'statues', 'collectible figures']],
];

/** Questions that need data Fandex doesn't have yet, and why. */
const UNSUPPORTED: [string[], string][] = [];

/** Words that make a question about what's missing from series. */
const SERIES_WORDS = ['missing', 'gaps', 'incomplete', 'complete the series', 'next volume'];
/** Words in a series question that aren't part of a series' name. */
const SERIES_FILLER = new Set(
  (
    'what whats which am i im do does have has my of from in the a an any series volume volumes ' +
    'book books manga mangas comic comics graphic novels novel missing gaps incomplete complete ' +
    'next how many number for to me show tell are is still'
  ).split(' '),
);

/** Questions about the collection's money (pre-orders' balances are another matter). */
const VALUE_WORDS = ['worth', 'value', 'price', 'prices', 'cost', 'paid', 'spent'];
const VALUE_REASON = "Fandex doesn't track what items are worth or what you spent on them.";

/** Words that make a question about pre-orders. */
const PREORDER_WORDS = [
  'pre order',
  'pre orders',
  'preorder',
  'preorders',
  'pre ordered',
  'preordered',
  'on order',
  'arriving',
  'arrive',
  'arrives',
  'coming out',
  'come out',
  'upcoming',
  'release',
  'releases',
  'owe',
  'owed',
  'balance',
  'left to pay',
  'delayed',
  'slipped',
  'pushed back',
];
const OWED_WORDS = ['owe', 'owed', 'balance', 'left to pay', 'due', 'pay'];
const DELAYED_WORDS = ['delayed', 'slipped', 'pushed back', 'late'];

/** One-word character names that are everyday words in a question ("my child's books"). */
const COMMON_WORDS = new Set([
  'child',
  'merry',
  'blue',
  'wax',
  'chopper',
  'crocodile',
  'smoker',
  'buggy',
  'hound',
  'mater',
  'reek',
  'brook',
]);

const ALL_ITEMS = ['everything', 'my collection', 'what do i own', 'what do i have', 'all my'];

function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** When pre-orders arrive: this week, this or next month, this or next year, soon. */
function arrivalRange(
  text: string,
  today: Date,
): Pick<CollectionQuery, 'arrivingAfter' | 'arrivingBefore'> {
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  const d = today.getUTCDate();
  const day = (year: number, month: number, date = 1) =>
    utcDay(new Date(Date.UTC(year, month, date)));
  const range = (arrivingAfter: string, arrivingBefore: string) => ({
    arrivingAfter,
    arrivingBefore,
  });
  if (containsPhrase(text, 'today')) return range(day(y, m, d), day(y, m, d + 1));
  if (containsPhrase(text, 'this week')) {
    const monday = d - ((today.getUTCDay() + 6) % 7);
    return range(day(y, m, monday), day(y, m, monday + 7));
  }
  if (containsPhrase(text, 'next week')) {
    const monday = d - ((today.getUTCDay() + 6) % 7) + 7;
    return range(day(y, m, monday), day(y, m, monday + 7));
  }
  if (containsPhrase(text, 'this month')) return range(day(y, m), day(y, m + 1));
  if (containsPhrase(text, 'next month')) return range(day(y, m + 1), day(y, m + 2));
  if (containsPhrase(text, 'this year')) return range(day(y, 0), day(y + 1, 0));
  if (containsPhrase(text, 'next year')) return range(day(y + 1, 0), day(y + 2, 0));
  if (containsPhrase(text, 'soon')) return range(day(y, m, d), day(y, m, d + 30));
  return {};
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

/**
 * "Which manga series am I missing volumes of?", "What am I missing from Stormlight?": the
 * kinds of series asked about, and any other words as part of a series' name.
 */
function seriesQuestion(text: string): CollectionQuery {
  const categories = (['book', 'manga', 'comic'] as const).filter((category) =>
    CATEGORY_WORDS.find(([c]) => c === category)![1].some((word) => containsPhrase(text, word)),
  );
  const titleWords = text.split(' ').filter((word) => word && !SERIES_FILLER.has(word));
  return collectionQuery({
    scope: 'series',
    categories,
    titleWords,
    answer:
      containsPhrase(text, 'how many') || containsPhrase(text, 'number of') ? 'count' : 'list',
  });
}

export function parseQuestionLocally(
  question: string,
  {
    seed = UNIVERSE_SEED,
    today = new Date(),
  }: { seed?: readonly UniverseSeed[]; today?: Date } = {},
): CollectionQuery {
  let text = normalizeText(question);
  const says = (phrases: readonly string[]) =>
    phrases.some((phrase) => containsPhrase(text, normalizeText(phrase)));

  for (const [phrases, reason] of UNSUPPORTED) {
    if (says(phrases)) return collectionQuery({ unsupported: reason });
  }
  const preorders = says(PREORDER_WORDS);
  if (!preorders && says(SERIES_WORDS)) return seriesQuestion(text);
  if (!preorders && says(VALUE_WORDS)) return collectionQuery({ unsupported: VALUE_REASON });

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

  const counting = containsPhrase(text, 'how many') || containsPhrase(text, 'number of');
  const sort =
    containsPhrase(text, 'alphabetical') || containsPhrase(text, 'a to z') ? 'title' : 'recent';
  // A character already says which universe it's from.
  const items = {
    universes: universes.filter((slug) => !characters.some((ref) => ref.universe === slug)),
    characters,
    categories,
    sort,
    answer: counting ? 'count' : 'list',
  } as const;

  if (preorders) {
    return collectionQuery({
      ...items,
      scope: 'preorders',
      ...arrivalRange(text, today),
      balanceDue: says(OWED_WORDS),
      delayed: says(DELAYED_WORDS),
    });
  }

  const dates = dateRange(text, today);
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

  return collectionQuery({ ...items, ...dates });
}
