import { parseFigureNumber } from './figures/figure-number';
import type { Money } from './preorders/money';
import type { ReleaseDate } from './preorders/release-date';
import type { MatchSignals } from './universes/match-signals';
import { matchUniverses, type CharacterRef } from './universes/match-universes';
import { UNIVERSE_SEED, type UniverseSeed } from './universes/universe-seed';

/**
 * A premium figure (Hot Toys, InArt…). No public catalog covers them, so they come from
 * Fandex's own curated list (`fandex`, shared by everyone) or are added by hand (`custom`,
 * private to their owner).
 */
export type CatalogFigure = {
  source: 'fandex' | 'custom';
  /**
   * The curated entry's stable id (`fandex`), or a UUID made where a hand-added figure was
   * created (the device for guests, the API otherwise).
   */
  externalId: string;
  category: 'figure';
  /** Our own catalog id, once the figure is saved through the Fandex API. */
  catalogId?: string;
  /** "Gandalf the Grey". */
  title: string;
  /** The maker: "Hot Toys", "Sideshow", "Iron Studios". */
  brand?: string;
  /** The product line: "Movie Masterpiece Series". */
  line?: string;
  /** "1/6", "1/4", "Life-size". */
  scale?: string;
  /** As printed on the box: "MMS 649" (see `parseFigureNumber`). */
  number?: string;
  /** Which version, when there are several: "Deluxe", "Premium", "Special Edition". */
  edition?: string;
  /** When it came out, or is expected to. */
  release?: ReleaseDate;
  /** Its original retail price. */
  price?: Money;
  /** Curated figures: the pages their facts were checked against. */
  sources?: string[];
  coverUrl?: string;
  /** Universes this figure belongs to (slugs), matched from its name and line. */
  universes?: string[];
  /** Characters it depicts, each with its universe. */
  characters?: CharacterRef[];
};

/** What a new figure needs: the rest (ids, links) is filled in where it's saved. */
export type NewFigure = Pick<
  CatalogFigure,
  'title' | 'brand' | 'line' | 'scale' | 'coverUrl' | 'number' | 'edition' | 'release' | 'price'
>;

/** The clues universe matching gets from a figure: its name, and its line as a series. */
export function figureMatchSignals(figure: NewFigure): MatchSignals {
  return { title: figure.title, ...(figure.line && { series: [figure.line] }) };
}

/**
 * A figure entry made on the device (guest mode): universes and characters matched here with
 * core's matcher, the same way the API does for accounts.
 */
export function createFigure(
  figure: NewFigure,
  { externalId, seed = UNIVERSE_SEED }: { externalId: string; seed?: readonly UniverseSeed[] },
): CatalogFigure {
  const { universes, characters } = matchUniverses(figureMatchSignals(figure), seed);
  return {
    source: 'custom',
    externalId,
    category: 'figure',
    ...trimmed(figure),
    ...(universes.length > 0 && { universes: [...universes] }),
    ...(characters.length > 0 && { characters: [...characters] }),
  };
}

/**
 * The figure's fields with blanks dropped, so an empty "brand" isn't stored as "". A box
 * number we can read is written our way ("mms649" → "MMS 649"); other codes are kept as typed.
 */
export function trimmed(figure: NewFigure): NewFigure {
  const optional = (value: string | undefined) => value?.trim() || undefined;
  const brand = optional(figure.brand);
  const line = optional(figure.line);
  const scale = optional(figure.scale);
  const coverUrl = optional(figure.coverUrl);
  const edition = optional(figure.edition);
  const typedNumber = optional(figure.number);
  const number = typedNumber && (parseFigureNumber(typedNumber)?.text ?? typedNumber);
  return {
    title: figure.title.trim(),
    ...(brand && { brand }),
    ...(line && { line }),
    ...(scale && { scale }),
    ...(coverUrl && { coverUrl }),
    ...(number && { number }),
    ...(edition && { edition }),
    ...(figure.release && { release: figure.release }),
    ...(figure.price && { price: figure.price }),
  };
}

/** "Hot Toys · MMS 279 · 1/6", "InArt · Deluxe · 1/6": maker, number, edition and scale, for lists. */
export function figureDetails(
  figure: Pick<CatalogFigure, 'brand' | 'number' | 'edition' | 'scale'>,
): string | undefined {
  return (
    [figure.brand, figure.number, figure.edition, figure.scale].filter(Boolean).join(' · ') ||
    undefined
  );
}
