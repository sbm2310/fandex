import { z } from 'zod';

import { FIGURE_SEED } from './figure-seed';
import {
  figureFromSeed,
  figureSeedEntrySchema,
  figureSeedProblems,
  parseSeedDate,
  parseSeedPrice,
} from './figure-seed-entry';

const parse = (entries: unknown[]) => z.array(figureSeedEntrySchema).parse(entries);

const gandalf = {
  id: 'inart-gandalf-the-grey',
  brand: 'inart',
  line: 'sixth-scale',
  name: 'Gandalf the Grey',
  universe: 'middle-earth',
  characters: ['gandalf'],
  announced: '2022-08',
  release: '2023-Q2',
  price: 'USD 445.00',
  sources: ['https://global.inart.studio/products/gandalf-the-grey-1-6-collectible-figure'],
};

describe('the curated figure list', () => {
  it('has no problems', () => {
    expect(figureSeedProblems(FIGURE_SEED)).toEqual([]);
  });

  it('covers InArt and Hot Toys for Star Wars, Marvel and DC', () => {
    const count = (brand: string, universe?: string) =>
      FIGURE_SEED.filter((e) => e.brand === brand && (!universe || e.universe === universe)).length;
    expect(count('inart')).toBeGreaterThanOrEqual(40);
    for (const universe of ['star-wars', 'marvel', 'dc']) {
      expect(count('hot-toys', universe)).toBeGreaterThanOrEqual(20);
    }
  });
});

describe('a curated entry', () => {
  it('becomes a shared catalog figure', () => {
    const [entry] = parse([gandalf]);
    expect(figureFromSeed(entry!)).toEqual({
      source: 'fandex',
      externalId: 'inart-gandalf-the-grey',
      category: 'figure',
      title: 'Gandalf the Grey',
      brand: 'InArt',
      line: 'Sixth Scale Collectible Figure',
      scale: '1/6',
      release: { date: '2023-04-01', precision: 'quarter' },
      price: { amount: 44500, currency: 'USD' },
      universes: ['middle-earth'],
      characters: [{ universe: 'middle-earth', character: 'gandalf' }],
    });
  });

  it('reads dates as precisely as they are written', () => {
    expect(parseSeedDate('2023')).toEqual({ date: '2023-01-01', precision: 'year' });
    expect(parseSeedDate('2023-Q3')).toEqual({ date: '2023-07-01', precision: 'quarter' });
    expect(parseSeedDate('2023-05')).toEqual({ date: '2023-05-01', precision: 'month' });
    expect(parseSeedDate('2023-05-17')).toEqual({ date: '2023-05-17', precision: 'day' });
    for (const bad of ['23', '2023-13', '2023-02-30', '2023-Q5', '2023-Q1-01', 'May 2023']) {
      expect(parseSeedDate(bad)).toBeNull();
    }
  });

  it('reads prices with their currency', () => {
    expect(parseSeedPrice('USD 445.00')).toEqual({ amount: 44500, currency: 'USD' });
    expect(parseSeedPrice('JPY 42000')).toEqual({ amount: 42000, currency: 'JPY' });
    for (const bad of ['445', '$445', 'USD', 'USD 0', 'XYZ 10', 'USD 4.455', 'USD 1 2']) {
      expect(parseSeedPrice(bad)).toBeNull();
    }
  });

  it('needs a source, a readable id and only known fields', () => {
    const invalid = [
      { ...gandalf, sources: [] },
      { ...gandalf, sources: ['http://example.com'] },
      { ...gandalf, id: 'Gandalf The Grey' },
      { ...gandalf, price: '445' },
      { ...gandalf, release: 'soon' },
      { ...gandalf, film: 'The Fellowship of the Ring' },
    ];
    for (const entry of invalid) {
      expect(figureSeedEntrySchema.safeParse(entry).success).toBe(false);
    }
  });

  it.each([
    [{ brand: 'sideshow' }, 'unknown brand "sideshow"'],
    [{ line: 'mms' }, 'unknown line "mms" for InArt'],
    [{ universe: 'narnia' }, 'unknown universe "narnia"'],
    [{ characters: ['frodo'] }, 'unknown character "frodo" in Middle-earth'],
    [{ universe: undefined }, 'characters need a universe'],
    [{ announced: '2024' }, 'released before it was announced'],
    [{ brand: 'hot-toys', line: 'mms' }, 'Movie Masterpiece Series figures have a number'],
    [{ brand: 'hot-toys', line: 'mms', number: 'MMS649' }, 'write the number as "MMS 649"'],
    [{ brand: 'hot-toys', line: 'mms', number: 'DX 12' }, 'number "DX 12" belongs to another line'],
    [{ brand: 'hot-toys', line: 'mms', number: 'MMS' }, 'unreadable number "MMS"'],
  ])('reports %p', (change, message) => {
    expect(figureSeedProblems(parse([{ ...gandalf, ...change }]))).toEqual([
      `inart-gandalf-the-grey: ${message}`,
    ]);
  });

  it('reports two entries for one figure', () => {
    const copy = { ...gandalf, id: 'inart-gandalf' };
    expect(figureSeedProblems(parse([gandalf, gandalf]))).toContain(
      'inart-gandalf-the-grey: duplicate id',
    );
    expect(figureSeedProblems(parse([gandalf, copy]))).toEqual([
      'inart-gandalf-the-grey: same figure as inart-gandalf',
    ]);
    // Another edition or scale is another figure.
    const standard = { ...gandalf, edition: 'Standard' };
    expect(figureSeedProblems(parse([standard, { ...copy, edition: 'Deluxe' }]))).toEqual([]);
    expect(figureSeedProblems(parse([gandalf, { ...copy, line: 'twelfth-scale' }]))).toEqual([]);
  });
});
