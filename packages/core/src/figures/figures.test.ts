import { catalogItemSchema, figureNumberSchema } from '../contracts';
import {
  FIGURE_BRANDS,
  figureNameKey,
  findFigureBrand,
  findFigureNumber,
  parseFigureNumber,
  sameFigure,
  scaleKey,
  type ComparableFigure,
} from '.';

describe('figure brands', () => {
  it('finds a brand by any common spelling', () => {
    expect(findFigureBrand('Hot Toys')?.id).toBe('hot-toys');
    expect(findFigureBrand('HOT TOYS')?.id).toBe('hot-toys');
    expect(findFigureBrand('HotToys')?.id).toBe('hot-toys');
    expect(findFigureBrand('INART')?.id).toBe('inart');
    expect(findFigureBrand('Sideshow')).toBeUndefined();
    expect(findFigureBrand('  ')).toBeUndefined();
  });

  it('has unique brand and line ids, and unique line codes', () => {
    const ids = FIGURE_BRANDS.map((brand) => brand.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const brand of FIGURE_BRANDS) {
      const lineIds = brand.lines.map((line) => line.id);
      expect(new Set(lineIds).size).toBe(lineIds.length);
    }
    const prefixes = FIGURE_BRANDS.flatMap((brand) => brand.lines.map((line) => line.prefix));
    const known = prefixes.filter(Boolean);
    expect(new Set(known).size).toBe(known.length);
    // Codes are matched in capitals.
    expect(known.every((prefix) => prefix === prefix?.toUpperCase())).toBe(true);
  });
});

describe('parseFigureNumber', () => {
  it.each([
    ['MMS 649', 'MMS 649'],
    ['MMS649', 'MMS 649'],
    ['mms-649', 'MMS 649'],
    ['MMS #649', 'MMS 649'],
    [' TMS007 ', 'TMS 7'],
    ['DX 27', 'DX 27'],
    ['VGM46', 'VGM 46'],
    ['QS 019', 'QS 19'],
    ['MMS 528 D30', 'MMS 528 D30'],
    ['MMS528D30', 'MMS 528 D30'],
  ])('reads %p as %p', (input, text) => {
    expect(parseFigureNumber(input)?.text).toBe(text);
  });

  it('names the brand and line', () => {
    const number = parseFigureNumber('mms649');
    expect(number).toMatchObject({ value: 649, brand: { name: 'Hot Toys' } });
    expect(number?.line.name).toBe('Movie Masterpiece Series');
    expect(number?.diecast).toBeUndefined();
    expect(parseFigureNumber('MMS 528 D30')).toMatchObject({ value: 528, diecast: 30 });
    expect(parseFigureNumber('QS 19')?.line.scale).toBe('1/4');
  });

  it.each([
    'MMS', // no number
    'MMS 0',
    'MMS 00 D3',
    'MMS 528 D0',
    'MMS 12345', // too long
    'ABC 123', // a code we don't know
    '75192', // a LEGO set
    'Gandalf the Grey',
    'MMS 649 Gandalf', // not only a number
  ])('rejects %p', (input) => {
    expect(parseFigureNumber(input)).toBeNull();
  });

  it('finds a number inside longer text', () => {
    expect(findFigureNumber('hot toys mms 649 gandalf')?.text).toBe('MMS 649');
    expect(findFigureNumber('Darth Vader (DX27)')?.text).toBe('DX 27');
    expect(findFigureNumber('Movie Masterpiece Series, 1/6 scale')).toBeNull();
    // Skips a code-like word that isn't a line, keeps looking.
    expect(findFigureNumber('ABC 12 then TMS 33')?.text).toBe('TMS 33');
  });
});

describe('sameFigure', () => {
  const gandalf: ComparableFigure = {
    title: 'Gandalf the Grey',
    brand: 'Hot Toys',
    number: 'MMS 649',
    scale: '1/6',
    characters: [{ universe: 'middle-earth', character: 'gandalf' }],
  };

  it('decides by box number when both have one', () => {
    expect(sameFigure(gandalf, { title: 'Gandalf', brand: 'HOT TOYS', number: 'mms649' })).toBe(
      true,
    );
    // Same name, other number: a different release (e.g. a Deluxe version).
    expect(sameFigure(gandalf, { ...gandalf, number: 'MMS 650' })).toBe(false);
    expect(sameFigure(gandalf, { ...gandalf, number: 'DX 649' })).toBe(false);
    // The die-cast count doesn't make it another figure.
    expect(
      sameFigure({ title: 'Iron Man', number: 'MMS 528' }, { title: 'x', number: 'MMS 528 D30' }),
    ).toBe(true);
  });

  it('never matches figures by different makers', () => {
    expect(sameFigure(gandalf, { ...gandalf, brand: 'InArt' })).toBe(false);
    expect(sameFigure(gandalf, { ...gandalf, brand: 'Sideshow' })).toBe(false);
  });

  it('compares names without the maker, scale or "collectible figure"', () => {
    const typed: ComparableFigure = {
      title: 'Hot Toys Gandalf the Grey 1/6th Scale Collectible Figure',
      brand: 'Hot Toys',
    };
    expect(sameFigure(gandalf, typed)).toBe(true);
    expect(sameFigure(gandalf, { title: 'Gandalf the White', brand: 'Hot Toys' })).toBe(false);
    expect(sameFigure({ title: 'Figure' }, { title: '1/6 scale figure' })).toBe(false);
  });

  it("doesn't match when scale, edition or characters contradict", () => {
    const plain: ComparableFigure = { title: 'Gandalf the Grey', brand: 'Hot Toys' };
    expect(sameFigure(plain, { ...plain, scale: 'Sixth scale' })).toBe(true);
    expect(sameFigure({ ...plain, scale: '1:6' }, { ...plain, scale: '1/4' })).toBe(false);
    expect(sameFigure({ ...plain, edition: 'Deluxe' }, { ...plain, edition: 'deluxe' })).toBe(true);
    expect(sameFigure({ ...plain, edition: 'Deluxe' }, plain)).toBe(true);
    expect(sameFigure({ ...plain, edition: 'Deluxe' }, { ...plain, edition: 'Standard' })).toBe(
      false,
    );
    expect(
      sameFigure(gandalf, {
        ...plain,
        characters: [{ universe: 'wizarding-world', character: 'albus-dumbledore' }],
      }),
    ).toBe(false);
  });

  it('normalizes scales and names', () => {
    expect(scaleKey('1:6')).toBe('1/6');
    expect(scaleKey('1/6th scale')).toBe('1/6');
    expect(scaleKey('Quarter Scale')).toBe('1/4');
    expect(scaleKey('Life-size')).toBe('life size');
    expect(figureNameKey('HotToys The Mandalorian Collectible Figure')).toBe('mandalorian');
  });
});

describe('figure contracts', () => {
  it('writes figure numbers our way', () => {
    expect(figureNumberSchema.parse('mms649')).toBe('MMS 649');
    expect(figureNumberSchema.safeParse('Gandalf').success).toBe(false);
  });

  it('carries a shared figure with its number, edition, release and price', () => {
    const item = catalogItemSchema.parse({
      id: '0199c3a4-5b6e-7c8d-9e0f-1a2b3c4d5e6f',
      category: 'figure',
      source: 'fandex',
      externalId: 'hot-toys-mms-649',
      title: 'Gandalf the Grey',
      creators: ['Hot Toys'],
      figureNumber: 'MMS 649',
      edition: 'Deluxe',
      releaseDate: { date: '2027-03-17', precision: 'month' },
      price: { amount: 29999, currency: 'USD' },
    });
    expect(item.releaseDate).toEqual({ date: '2027-03-01', precision: 'month' });
    expect(item.price).toEqual({ amount: 29999, currency: 'USD' });
    expect(
      catalogItemSchema.safeParse({ ...item, price: { amount: 1.5, currency: 'USD' } }).success,
    ).toBe(false);
  });
});
