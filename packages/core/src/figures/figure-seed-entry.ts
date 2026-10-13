import { z } from 'zod';

import type { CatalogFigure } from '../catalog-figure';
import type { MatchSignals } from '../universes/match-signals';
import { CURRENCIES, parseMoney, type Currency, type Money } from '../preorders/money';
import { releaseDate, type ReleaseDate } from '../preorders/release-date';
import { findUniverse, UNIVERSE_SEED, type UniverseSeed } from '../universes/universe-seed';
import { FIGURE_BRANDS, type FigureBrand } from './figure-brands';
import { parseFigureNumber } from './figure-number';
import { sameFigure } from './same-figure';

/**
 * One figure in Fandex's curated list (`@fandex/core/figure-seed`). Facts we wrote ourselves
 * after checking public sources (no copied text or pictures), each entry listing the pages it
 * was checked against. Kept as JSON so additions are easy to review.
 */

/** "2023", "2023-Q2", "2023-05" or "2023-05-17": as precise as the sources are. */
export function parseSeedDate(text: string): ReleaseDate | null {
  const match = /^(\d{4})(?:-(?:Q([1-4])|(\d{2}))(?:-(\d{2}))?)?$/.exec(text);
  if (!match) return null;
  const [, year, quarter, month, day] = match;
  if (quarter)
    return day ? null : releaseDate(`${year}-${pad((+quarter - 1) * 3 + 1)}-01`, 'quarter');
  if (!month) return releaseDate(`${year}-01-01`, 'year');
  if (+month < 1 || +month > 12) return null;
  if (!day) return releaseDate(`${year}-${month}-01`, 'month');
  const iso = `${year}-${month}-${day}`;
  // Rejects "2023-02-30" (Date rolls it over to March).
  return new Date(`${iso}T00:00:00Z`).toISOString().startsWith(iso)
    ? releaseDate(iso, 'day')
    : null;
}

function pad(month: number): string {
  return String(month).padStart(2, '0');
}

/** "USD 445.00" → { amount: 44500, currency: 'USD' }: readable in the JSON, exact in code. */
export function parseSeedPrice(text: string): Money | null {
  const [currency, amount, ...rest] = text.trim().split(/\s+/);
  if (rest.length > 0 || !amount || !CURRENCIES.includes(currency as Currency)) return null;
  const minor = parseMoney(amount, currency as Currency);
  return minor ? { amount: minor, currency: currency as Currency } : null;
}

const seedDate = z.string().transform((value, ctx) => {
  const date = parseSeedDate(value);
  if (!date) {
    ctx.addIssue({ code: 'custom', message: `Not a date like 2023, 2023-Q2, 2023-05, 2023-05-17` });
    return z.NEVER;
  }
  return date;
});

const seedPrice = z.string().transform((value, ctx) => {
  const price = parseSeedPrice(value);
  if (!price) {
    ctx.addIssue({ code: 'custom', message: `Not a price like "USD 445.00"` });
    return z.NEVER;
  }
  return price;
});

const text = z.string().trim().min(1);

export const figureSeedEntrySchema = z.strictObject({
  /** Stable forever (it's the catalog item's external id): "hot-toys-mms-649", "inart-gandalf". */
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  /** A brand id from FIGURE_BRANDS. */
  brand: text,
  /** A line id of that brand. */
  line: text,
  /** As printed on the box, written our way ("MMS 649"). */
  number: text.optional(),
  /**
   * "Gandalf the Grey", without brand, scale or "collectible figure". Add the film, show or
   * game when the character has several figures: "Batman (The Dark Knight Rises)".
   */
  name: text,
  /** A universe slug from the universe seed, if it belongs to one. */
  universe: text.optional(),
  /** Character slugs within that universe (only ones the seed knows). */
  characters: z.array(text).optional(),
  /** "1/6". Defaults to the line's scale. */
  scale: text.optional(),
  /** "Deluxe", "Premium"… when the figure came in several versions. */
  edition: text.optional(),
  /** When it was first shown or opened for pre-order. */
  announced: seedDate.optional(),
  /** When it shipped, or is expected to. */
  release: seedDate.optional(),
  /** Original retail price: "USD 445.00". */
  price: seedPrice.optional(),
  /** Pages the facts were checked against (more than one where we could). */
  sources: z.array(z.url({ protocol: /^https$/ })).min(1),
  /** Anything the sources disagree on, or that's still unsure. */
  note: text.optional(),
});

export type FigureSeedEntry = z.output<typeof figureSeedEntrySchema>;

/** A curated entry as a catalog figure (the brand and line by name, links from its characters). */
export function figureFromSeed(
  entry: FigureSeedEntry,
  brands: readonly FigureBrand[] = FIGURE_BRANDS,
): CatalogFigure {
  const brand = brands.find((candidate) => candidate.id === entry.brand);
  const line = brand?.lines.find((candidate) => candidate.id === entry.line);
  const scale = entry.scale ?? line?.scale;
  const universes = entry.universe ? [entry.universe] : [];
  const characters = (entry.characters ?? []).map((character) => ({
    universe: entry.universe ?? '',
    character,
  }));
  return {
    source: 'fandex',
    externalId: entry.id,
    category: 'figure',
    title: entry.name,
    ...(brand && { brand: brand.name }),
    ...(line && { line: line.name }),
    ...(scale && { scale }),
    ...(entry.number && { number: entry.number }),
    ...(entry.edition && { edition: entry.edition }),
    ...(entry.release && { release: entry.release }),
    ...(entry.price && { price: entry.price }),
    ...(universes.length > 0 && { universes }),
    ...(characters.length > 0 && { characters }),
  };
}

/** A curated entry's universe signals: its own links, which no matcher second-guesses. */
export function figureSeedSignals(entry: FigureSeedEntry): MatchSignals {
  const universes = entry.universe ? [entry.universe] : [];
  const characters = universes.flatMap((universe) =>
    (entry.characters ?? []).map((character) => ({ universe, character })),
  );
  return { title: entry.name, curated: { universes, characters } };
}

/**
 * Everything wrong with a curated list (empty when it's fine): rules a schema can't express —
 * known brands, lines, universes and characters; numbers that parse to the entry's own line;
 * no two entries for one figure; dates in order.
 */
export function figureSeedProblems(
  entries: readonly FigureSeedEntry[],
  { brands = FIGURE_BRANDS, universes = UNIVERSE_SEED }: SeedReferences = {},
): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const entry of entries) {
    const problem = (message: string) => problems.push(`${entry.id}: ${message}`);
    if (ids.has(entry.id)) problem('duplicate id');
    ids.add(entry.id);

    const brand = brands.find((candidate) => candidate.id === entry.brand);
    const line = brand?.lines.find((candidate) => candidate.id === entry.line);
    if (!brand) problem(`unknown brand "${entry.brand}"`);
    else if (!line) problem(`unknown line "${entry.line}" for ${brand.name}`);

    if (entry.number) {
      const number = parseFigureNumber(entry.number, brands);
      if (!number) problem(`unreadable number "${entry.number}"`);
      else if (number.brand.id !== entry.brand || number.line.id !== entry.line) {
        problem(`number "${entry.number}" belongs to another line`);
      } else if (number.text !== entry.number) {
        problem(`write the number as "${number.text}"`);
      }
    } else if (line?.prefix) {
      problem(`${line.name} figures have a number`);
    }

    const universe = entry.universe ? findUniverse(entry.universe, universes) : undefined;
    if (entry.universe && !universe) problem(`unknown universe "${entry.universe}"`);
    if (entry.characters?.length && !entry.universe) problem('characters need a universe');
    for (const character of entry.characters ?? []) {
      if (universe && !universe.characters.some((known) => known.slug === character)) {
        problem(`unknown character "${character}" in ${universe.name}`);
      }
    }

    if (entry.announced && entry.release && entry.release.date < entry.announced.date) {
      problem('released before it was announced');
    }
  }

  const figures = entries.map((entry) => figureFromSeed(entry, brands));
  figures.forEach((a, i) => {
    figures.slice(i + 1).forEach((b, j) => {
      if (sameFigure(a, b, brands)) {
        problems.push(`${a.externalId}: same figure as ${entries[i + 1 + j]!.id}`);
      }
    });
  });
  return problems;
}

export type SeedReferences = {
  brands?: readonly FigureBrand[];
  universes?: readonly UniverseSeed[];
};
