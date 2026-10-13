import type { CatalogFigure } from '../catalog-figure';
import { normalizeName, normalizeText } from '../universes/normalize-name';
import { FIGURE_BRANDS, findFigureBrand, type FigureBrand } from './figure-brands';
import { parseFigureNumber, sameFigureNumber } from './figure-number';

/** What's compared to tell whether two figure entries are the same product. */
export type ComparableFigure = Pick<
  CatalogFigure,
  'title' | 'brand' | 'number' | 'scale' | 'edition' | 'characters'
>;

/**
 * True if two entries describe the same figure (to spot a suggestion that duplicates a catalog
 * entry). Different makers never match. When both have a box number, the number decides
 * (a Deluxe version has its own). Otherwise the names must match, and the scale, edition and
 * characters must not contradict each other where both say.
 */
export function sameFigure(
  a: ComparableFigure,
  b: ComparableFigure,
  brands: readonly FigureBrand[] = FIGURE_BRANDS,
): boolean {
  const brandA = a.brand ? brandKey(a.brand, brands) : undefined;
  const brandB = b.brand ? brandKey(b.brand, brands) : undefined;
  if (brandA && brandB && brandA !== brandB) return false;

  const numberA = a.number ? parseFigureNumber(a.number, brands) : null;
  const numberB = b.number ? parseFigureNumber(b.number, brands) : null;
  if (numberA && numberB) return sameFigureNumber(numberA, numberB);

  if (differ(a.scale, b.scale, scaleKey) || differ(a.edition, b.edition, normalizeText)) {
    return false;
  }
  if (a.characters?.length && b.characters?.length) {
    const shared = a.characters.some((x) =>
      b.characters?.some((y) => x.universe === y.universe && x.character === y.character),
    );
    if (!shared) return false;
  }
  const names = [a, b].map((figure) => figureNameKey(figure.title, brands));
  return names[0] !== '' && names[0] === names[1];
}

function brandKey(name: string, brands: readonly FigureBrand[]): string {
  return findFigureBrand(name, brands)?.id ?? normalizeText(name);
}

/** Both known and different. */
function differ(
  a: string | undefined,
  b: string | undefined,
  key: (value: string) => string,
): boolean {
  return !!a && !!b && key(a) !== key(b);
}

/** "1:6", "1/6th", "Sixth Scale" → "1/6"; anything else as normalized text ("life size"). */
export function scaleKey(scale: string): string {
  const text = normalizeText(scale).replace(/ scale$/, '');
  const ratio = /^1 (\d+)(?:st|nd|rd|th)?$/.exec(text);
  if (ratio) return `1/${ratio[1]}`;
  const words: Record<string, string> = { sixth: '1/6', quarter: '1/4', twelfth: '1/12' };
  return words[text] ?? text;
}

// Words a name often carries that don't tell figures apart: the scale and "collectible figure".
const NAME_NOISE =
  /\b(?:1 \d+(?:st|nd|rd|th)?|sixth|quarter|twelfth)(?: scale)?\b|\b(?:collectible )?figures?\b/g;

/** A figure's name for comparison: normalized, without its maker or boilerplate. */
export function figureNameKey(
  title: string,
  brands: readonly FigureBrand[] = FIGURE_BRANDS,
): string {
  let name = normalizeText(title);
  for (const brand of brands) {
    for (const spelling of [brand.name, ...brand.aliases]) {
      const prefix = `${normalizeText(spelling)} `;
      if (name.startsWith(prefix)) name = name.slice(prefix.length);
    }
  }
  return normalizeName(name.replace(NAME_NOISE, ' '));
}
