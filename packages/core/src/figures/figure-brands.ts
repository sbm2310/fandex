import { normalizeText } from '../universes/normalize-name';

/**
 * Premium figure makers Fandex knows, with their product lines. Hot Toys prints a line code
 * and a number on every box ("MMS 649": Movie Masterpiece Series no. 649), which identifies a
 * figure better than its name (there are many Gandalfs). Facts only, written by us.
 */

export type FigureLine = {
  /** Stable id: "mms". */
  id: string;
  /** "Movie Masterpiece Series". */
  name: string;
  /** The code printed before the number ("MMS"), when the line numbers its figures. */
  prefix?: string;
  /** The line's usual scale ("1/6"); a figure can still say otherwise. */
  scale?: string;
};

export type FigureBrand = {
  /** Stable id: "hot-toys". */
  id: string;
  /** As it's written: "Hot Toys". */
  name: string;
  /** Other spellings people and boxes use, compared normalized ("HotToys"). */
  aliases: readonly string[];
  lines: readonly FigureLine[];
};

export const FIGURE_BRANDS: readonly FigureBrand[] = [
  {
    id: 'hot-toys',
    name: 'Hot Toys',
    aliases: ['HotToys', 'Hot Toy'],
    lines: [
      { id: 'mms', name: 'Movie Masterpiece Series', prefix: 'MMS', scale: '1/6' },
      // Deluxe-size movie figures with their own numbering ("DX 27").
      { id: 'dx', name: 'Movie Masterpiece Series DX', prefix: 'DX', scale: '1/6' },
      { id: 'tms', name: 'Television Masterpiece Series', prefix: 'TMS', scale: '1/6' },
      { id: 'vgm', name: 'Video Game Masterpiece Series', prefix: 'VGM', scale: '1/6' },
      { id: 'cms', name: 'Comic Masterpiece Series', prefix: 'CMS', scale: '1/6' },
      { id: 'qs', name: 'Quarter Scale Series', prefix: 'QS', scale: '1/4' },
      { id: 'pps', name: 'Power Pose Series', prefix: 'PPS', scale: '1/6' },
      { id: 'acs', name: 'Accessories Collection Series', prefix: 'ACS' },
      { id: 'cosbaby', name: 'Cosbaby', prefix: 'COSB' },
    ],
  },
  {
    id: 'inart',
    name: 'InArt',
    aliases: ['In Art'],
    // InArt names its figures without a printed series number (as far as we know; the
    // curated list in Task 2 will say), so its figures are told apart by name and edition.
    lines: [{ id: 'sixth-scale', name: 'Sixth Scale Collectible Figure', scale: '1/6' }],
  },
];

/** The brand a name refers to ("hot toys", "HOT TOYS", "HotToys" → Hot Toys), if we know it. */
export function findFigureBrand(
  name: string,
  brands: readonly FigureBrand[] = FIGURE_BRANDS,
): FigureBrand | undefined {
  const wanted = compact(name);
  if (!wanted) return undefined;
  return brands.find((brand) => [brand.name, ...brand.aliases].some((n) => compact(n) === wanted));
}

/** Normalized without spaces, so "Hot Toys" and "HotToys" compare equal. */
function compact(name: string): string {
  return normalizeText(name).replace(/ /g, '');
}

/** The line whose box code is `prefix` ("mms" → Hot Toys' Movie Masterpiece Series). */
export function findFigureLine(
  prefix: string,
  brands: readonly FigureBrand[] = FIGURE_BRANDS,
): { brand: FigureBrand; line: FigureLine } | undefined {
  const wanted = prefix.toUpperCase();
  for (const brand of brands) {
    const line = brand.lines.find((candidate) => candidate.prefix === wanted);
    if (line) return { brand, line };
  }
  return undefined;
}
