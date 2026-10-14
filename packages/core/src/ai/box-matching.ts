import { findFigureBrand } from '../figures/figure-brands';
import { parseFigureNumber, sameFigureNumber } from '../figures/figure-number';
import { scaleKey } from '../figures/same-figure';
import { searchFigures, type SearchableFigure } from '../figures/search-figures';
import { normalizeText } from '../universes/normalize-name';
import type { BoxReading } from './box-reading';

/** A catalog figure that may be the one on the box, and how it was found. */
export type BoxCandidate<T> = { figure: T; by: 'number' | 'name' };

/** Figures to offer for one box. */
const MAX_CANDIDATES = 4;

type Matchable = SearchableFigure & { scale?: string };

/**
 * The catalog figures a box reading may be, best first. A box number we can read decides:
 * it finds exactly that figure (models do misread digits, so a number nobody has falls back
 * to the name). Otherwise the printed name is searched — then the character, if the name
 * finds nothing — preferring the maker read on the box (other makers' figures stay, last), then
 * the same edition and scale.
 */
export function matchBoxReading<T extends Matchable>(
  reading: BoxReading,
  figures: readonly T[],
): BoxCandidate<T>[] {
  const number = reading.number ? parseFigureNumber(reading.number) : null;
  if (number) {
    const exact = figures.filter((figure) => {
      const own = figure.number ? parseFigureNumber(figure.number) : null;
      return own !== null && sameFigureNumber(own, number);
    });
    if (exact.length > 0) {
      return exact.slice(0, MAX_CANDIDATES).map((figure) => ({ figure, by: 'number' }));
    }
  }

  const queries = [reading.name, reading.character].filter((q): q is string => !!q);
  let found: T[] = [];
  for (const query of queries) {
    found = searchFigures(figures, query, { limit: 20 });
    if (found.length > 0) break;
  }

  const brand =
    reading.brand && (findFigureBrand(reading.brand)?.id ?? normalizeText(reading.brand));
  const score = (figure: T) => {
    const own = figure.brand && (findFigureBrand(figure.brand)?.id ?? normalizeText(figure.brand));
    return (
      (brand && own === brand ? 4 : 0) +
      (reading.edition &&
      figure.edition &&
      normalizeText(figure.edition) === normalizeText(reading.edition)
        ? 2
        : 0) +
      (reading.scale && figure.scale && scaleKey(figure.scale) === scaleKey(reading.scale) ? 1 : 0)
    );
  };
  // Stable: equal scores keep search order (best name match first).
  return found
    .map((figure, index) => ({ figure, index, score: score(figure) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, MAX_CANDIDATES)
    .map(({ figure }) => ({ figure, by: 'name' }));
}
