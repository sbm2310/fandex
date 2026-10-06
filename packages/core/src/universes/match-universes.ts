import {
  cleanMinifigNames,
  cleanPersonName,
  cleanPlaceName,
  containsPhrase,
  normalizeName,
  normalizeText,
  parseSubject,
  subjectText,
} from './normalize-name';
import type { MatchSignals } from './match-signals';
import { UNIVERSE_SEED, type UniverseSeed } from './universe-seed';

/**
 * Bump when the matching rules change, so stored links are recomputed (the API re-matches
 * every catalog item when this or the seed changes).
 */
export const UNIVERSE_MATCHER_VERSION = 1;

export type CharacterRef = { universe: string; character: string };

export type UniverseMatch = {
  /** Universe slugs, in seed order. */
  universes: string[];
  characters: CharacterRef[];
};

type NameEntry = { ref: CharacterRef; establishes: boolean };

/** Precomputed lookups for one seed (names → characters), built once per seed. */
type SeedIndex = {
  seed: readonly UniverseSeed[];
  namesByUniverse: Map<string, Map<string, NameEntry>>;
};

const indexes = new WeakMap<readonly UniverseSeed[], SeedIndex>();

function indexSeed(seed: readonly UniverseSeed[]): SeedIndex {
  const cached = indexes.get(seed);
  if (cached) return cached;

  // A name listed in two universes ("Captain Marvel") can't tell them apart on its own.
  const universesByName = new Map<string, Set<string>>();
  for (const universe of seed)
    for (const character of universe.characters)
      for (const name of [character.name, ...(character.aliases ?? [])]) {
        const key = normalizeName(name);
        universesByName.set(key, (universesByName.get(key) ?? new Set()).add(universe.slug));
      }

  const namesByUniverse = new Map<string, Map<string, NameEntry>>();
  for (const universe of seed) {
    const names = new Map<string, NameEntry>();
    for (const character of universe.characters) {
      const ref = { universe: universe.slug, character: character.slug };
      for (const name of [character.name, ...(character.aliases ?? [])]) {
        const key = normalizeName(name);
        // A single-word alias ("Alfred", "Logan", "Merry") is too common to establish a
        // universe by itself; the main name and multi-word aliases are distinctive enough.
        const distinctive = name === character.name || key.includes(' ');
        const establishes =
          !character.ambiguous && distinctive && universesByName.get(key)?.size === 1;
        const existing = names.get(key);
        names.set(key, { ref, establishes: establishes || (existing?.establishes ?? false) });
      }
    }
    namesByUniverse.set(universe.slug, names);
  }

  const index = { seed, namesByUniverse };
  indexes.set(seed, index);
  return index;
}

/**
 * Decides which universes and characters a catalog entry belongs to. A universe matches on
 * any one strong signal: a LEGO theme, a phrase in the title, series or subjects ("Lord of the
 * Rings"), a fictional place ("Rivendell"), or a distinctive character ("Gandalf"). Characters
 * then match by name inside the matched universes, so ambiguous names ("Thor", "Robin") only
 * count where something else already established the universe.
 */
export function matchUniverses(
  signals: MatchSignals,
  seed: readonly UniverseSeed[] = UNIVERSE_SEED,
): UniverseMatch {
  const { namesByUniverse } = indexSeed(seed);

  const titles = [signals.title, ...(signals.series ?? [])].map(normalizeText);
  const subjects = (signals.subjects ?? []).map(subjectText);
  const authors = new Set(
    (signals.authors ?? []).flatMap((a) => [normalizeName(a), cleanPersonName(a)]),
  );

  const people = new Set<string>();
  const places = new Set((signals.places ?? []).map(cleanPlaceName));
  for (const person of signals.people ?? []) people.add(cleanPersonName(person));
  for (const subject of signals.subjects ?? []) {
    const parsed = parseSubject(subject);
    if (parsed && 'person' in parsed) people.add(parsed.person);
    if (parsed && 'place' in parsed) places.add(parsed.place);
  }
  for (const minifig of signals.minifigs ?? [])
    for (const name of cleanMinifigNames(minifig)) people.add(name);
  for (const author of authors) people.delete(author);

  const themeIds = new Set(signals.legoThemeIds ?? []);
  const inTitles = (phrase: string) => {
    const normalized = normalizeText(phrase);
    return titles.some((title) => containsPhrase(title, normalized));
  };
  const inTitlesOrSubjects = (phrase: string) => {
    const normalized = normalizeText(phrase);
    return inTitles(phrase) || subjects.some((subject) => containsPhrase(subject, normalized));
  };

  const universes: string[] = [];
  const characters: CharacterRef[] = [];

  for (const universe of seed) {
    if (universe.excludePhrases?.some(inTitlesOrSubjects)) continue;
    const names = namesByUniverse.get(universe.slug) ?? new Map<string, NameEntry>();

    const matched =
      universe.legoThemeIds.some((id) => themeIds.has(id)) ||
      universe.titleAliases.some(inTitlesOrSubjects) ||
      universe.places.some((place) => places.has(normalizeName(place))) ||
      universe.characters.some((character) => character.titleNames?.some(inTitles)) ||
      [...people].some((person) => names.get(person)?.establishes === true);
    if (!matched) continue;

    universes.push(universe.slug);
    for (const character of universe.characters) {
      const named = [character.name, ...(character.aliases ?? [])].some((name) =>
        people.has(normalizeName(name)),
      );
      if (named || character.titleNames?.some(inTitles))
        characters.push({ universe: universe.slug, character: character.slug });
    }
  }

  return { universes, characters };
}
