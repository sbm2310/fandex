import type { CharacterRef } from '../universes/match-universes';
import { normalizeText } from '../universes/normalize-name';
import { UNIVERSE_SEED, type UniverseSeed } from '../universes/universe-seed';
import { FIGURE_BRANDS, type FigureBrand } from './figure-brands';
import { findFigureNumber, parseFigureNumber, sameFigureNumber } from './figure-number';

/** What figure search looks at: names, maker, line, edition, number and links. */
export type SearchableFigure = {
  title: string;
  brand?: string;
  line?: string;
  number?: string;
  edition?: string;
  universes: readonly string[];
  characters: readonly CharacterRef[];
};

// "1/6", "1:6", "1/6th scale", "sixth scale": every figure is one scale or another.
const SCALE =
  /\b1\s*[/:]\s*\d+(?:st|nd|rd|th)?(?:\s*scale)?\b|\b(?:sixth|quarter|twelfth)\s+scale\b/gi;
const FILLER = new Set([
  'the',
  'a',
  'an',
  'of',
  'and',
  'figure',
  'figures',
  'collectible',
  'scale',
  'version',
  'ver',
]);

/** How much a word found in each field counts; most when it starts the name ("Batman (…)"). */
const WEIGHT = { titleStart: 4, title: 3, character: 2, other: 1 } as const;

/**
 * Figures matching a search, best first. A box number ("MMS 649", "mms649") finds exactly
 * that figure. Otherwise every word must be found — in the name, a linked character's names,
 * the universe, maker, line or edition — as the start of a word ("vad" finds "Vader");
 * matches in the name count most, especially its first word.
 */
export function searchFigures<T extends SearchableFigure>(
  figures: readonly T[],
  query: string,
  {
    seed = UNIVERSE_SEED,
    brands = FIGURE_BRANDS,
    limit = 50,
  }: { seed?: readonly UniverseSeed[]; brands?: readonly FigureBrand[]; limit?: number } = {},
): T[] {
  const number = findFigureNumber(query, brands);
  if (number) {
    return figures
      .filter((figure) => {
        const own = figure.number ? parseFigureNumber(figure.number, brands) : null;
        return own !== null && sameFigureNumber(own, number);
      })
      .slice(0, limit);
  }

  const words = normalizeText(query.replace(SCALE, ' '))
    .split(' ')
    .filter((word) => word && !FILLER.has(word));
  if (words.length === 0) return [];

  const scored: { figure: T; score: number }[] = [];
  for (const figure of figures) {
    const fields = fieldsOf(figure, seed);
    let score = 0;
    for (const word of words) {
      const weight = bestWeight(word, fields);
      if (weight === 0) {
        score = 0;
        break;
      }
      score += weight;
    }
    if (score > 0) scored.push({ figure, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.figure.title.localeCompare(b.figure.title))
    .slice(0, limit)
    .map(({ figure }) => figure);
}

type Fields = { title: string[]; character: string[]; other: string[] };

function fieldsOf(figure: SearchableFigure, seed: readonly UniverseSeed[]): Fields {
  const words = (texts: (string | undefined)[]) =>
    texts.flatMap((text) => (text ? normalizeText(text).split(' ') : []));
  const characterNames = figure.characters.flatMap((ref) => {
    const character = seed
      .find((universe) => universe.slug === ref.universe)
      ?.characters.find((candidate) => candidate.slug === ref.character);
    return character ? [character.name, ...(character.aliases ?? [])] : [];
  });
  const universeNames = figure.universes.flatMap((slug) => {
    const universe = seed.find((candidate) => candidate.slug === slug);
    return universe ? [universe.name, ...universe.titleAliases] : [];
  });
  return {
    title: words([figure.title]),
    character: words(characterNames),
    other: words([figure.brand, figure.line, figure.edition, figure.number, ...universeNames]),
  };
}

function bestWeight(word: string, fields: Fields): number {
  // One letter or digit must be a whole word ("c" in "C-3PO"); longer ones may start a word.
  const found = (candidates: string[]) =>
    candidates.some((candidate) =>
      word.length === 1 ? candidate === word : candidate.startsWith(word),
    );
  if (found(fields.title.slice(0, 1))) return WEIGHT.titleStart;
  if (found(fields.title)) return WEIGHT.title;
  if (found(fields.character)) return WEIGHT.character;
  if (found(fields.other)) return WEIGHT.other;
  return 0;
}
