import { createFigureRequestSchema } from '../contracts';
import { trimmed } from '../catalog-figure';
import { FIGURE_SEED } from './figure-seed';
import { figureFromSeed, figureSeedSignals } from './figure-seed-entry';
import { searchFigures, type SearchableFigure } from './search-figures';

const catalog = FIGURE_SEED.map((entry) => {
  const figure = figureFromSeed(entry);
  return { ...figure, universes: figure.universes ?? [], characters: figure.characters ?? [] };
});
const titles = (query: string) => searchFigures(catalog, query).map((f) => f.externalId);

describe('searchFigures on the curated list', () => {
  it('finds a figure by name, best matches first', () => {
    expect(titles('Gandalf')).toEqual(['inart-gandalf-the-grey']);
    expect(titles('darth vader')[0]).toBe('hot-toys-mms-279');
    // Batman's own figures before Batgirl's (named after a Batman game).
    const batman = searchFigures(catalog, 'batman').map((f) => f.title);
    const lastBatman = Math.max(...batman.map((t, i) => (t.startsWith('Batman (') ? i : -1)));
    expect(batman.indexOf('Batgirl (Batman: Arkham Knight)')).toBeGreaterThan(lastBatman);
    expect(titles('vader')).toEqual(expect.arrayContaining(['hot-toys-mms-699', 'hot-toys-dx-27']));
  });

  it('finds a figure by its box number, written any common way', () => {
    expect(titles('MMS 279')).toEqual(['hot-toys-mms-279']);
    expect(titles('mms279')).toEqual(['hot-toys-mms-279']);
    expect(titles('Hot Toys TMS007')).toEqual(['hot-toys-tms-7']);
    expect(titles('MMS 528 D30')).toEqual(['hot-toys-mms-528']);
    expect(titles('MMS 1')).toEqual([]);
  });

  it("finds a figure through its character's other names", () => {
    // Lord Voldemort's figures are named "Voldemort"; Carol Danvers is Captain Marvel.
    expect(titles('carol danvers')).toEqual(['hot-toys-mms-521']);
  });

  it('needs every word (character names count), ignoring accents, scale and filler words', () => {
    expect(titles('nazgul')).toEqual(['inart-nazgul', 'inart-nazgul-deluxe']);
    expect(titles('Batman 1/6 collectible figure the dark knight rises')).toEqual(
      expect.arrayContaining(['hot-toys-dx-19']),
    );
    expect(titles('batman dark knight rises')).not.toContain(
      'inart-catwoman-the-dark-knight-rises',
    );
    expect(titles('gandalf dumbledore')).toEqual([]);
    expect(titles('the figure')).toEqual([]);
  });

  it('matches the maker and the edition', () => {
    // "Harry Potter" also names the universe: his own figures first, then the rest of it.
    const inart = titles('inart harry potter');
    expect(inart.slice(0, 3).sort()).toEqual([
      'inart-harry-potter',
      'inart-harry-potter-deluxe',
      'inart-harry-potter-goblet-of-fire',
    ]);
    expect(inart).toContain('inart-severus-snape');
    expect(titles('hot toys harry potter')).toEqual([]);
    expect(titles('draco deluxe')).toEqual(['inart-draco-malfoy-deluxe']);
  });

  it('counts a word in the name over one in the universe or line', () => {
    const figures: SearchableFigure[] = [
      { title: 'Robin (Batman Forever)', universes: ['dc'], characters: [] },
      { title: 'Batman', universes: ['dc'], characters: [] },
      { title: 'Alfred', line: 'Batman Line', universes: ['dc'], characters: [] },
    ];
    expect(searchFigures(figures, 'batman').map((f) => f.title)).toEqual([
      'Batman',
      'Robin (Batman Forever)',
      'Alfred',
    ]);
    expect(searchFigures(figures, 'batman', { limit: 1 })).toHaveLength(1);
  });
});

describe('curated figure signals', () => {
  it('carry the entry links as curated', () => {
    const entry = FIGURE_SEED.find((e) => e.id === 'inart-supergirl-2026')!;
    expect(figureSeedSignals(entry)).toEqual({
      title: 'Supergirl (Supergirl, 2026)',
      curated: { universes: ['dc'], characters: [] },
    });
  });
});

describe('figures added by hand', () => {
  it('keep a number, edition, release and price', () => {
    const request = createFigureRequestSchema.parse({
      title: 'Iron Man',
      number: ' mms528d30 ',
      edition: ' Deluxe ',
      release: { date: '2027-05-12', precision: 'quarter' },
      price: { amount: 42800, currency: 'USD' },
    });
    expect(request).toMatchObject({
      number: 'mms528d30',
      edition: 'Deluxe',
      release: { date: '2027-04-01', precision: 'quarter' },
      price: { amount: 42800, currency: 'USD' },
    });
    // Where it's saved, a number we can read is written our way.
    expect(trimmed({ title: 'Iron Man', number: ' mms528d30 ' })).toEqual({
      title: 'Iron Man',
      number: 'MMS 528 D30',
    });
    // A code we don't know is kept as typed.
    expect(trimmed({ title: 'x', number: 'SS-9001' }).number).toBe('SS-9001');
    expect(
      createFigureRequestSchema.safeParse({ title: 'x', number: 'x'.repeat(31) }).success,
    ).toBe(false);
  });
});
