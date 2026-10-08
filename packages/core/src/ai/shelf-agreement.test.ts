import readings from './__fixtures__/shelf-two-readings.json';
import { combineShelfReadings, readingAgreement } from './shelf-agreement';
import type { ShelfReading } from './shelf-reading';

const reading = (title: string, extra: Partial<ShelfReading> = {}): ShelfReading => ({
  kind: 'comic',
  title,
  count: 1,
  ...extra,
});

describe('readingAgreement', () => {
  it('needs more than a shared series name', () => {
    expect(readingAgreement(reading('Spider-Man: Gold'), reading('Spider-Man: Red'))).toBe(0.5);
    expect(readingAgreement(reading('Planet Hulk'), reading('World War Hulk'))).toBe(0.25);
  });

  it('counts a title read whole inside the other', () => {
    expect(readingAgreement(reading('Civil War'), reading('X-Men: Civil War'))).toBe(1);
    // …but not a single word ("Deadpool") inside anything with it.
    expect(
      readingAgreement(reading('Deadpool'), reading('Deadpool Kills the Marvel Universe')),
    ).toBeLessThan(0.6);
  });

  it('compares the English titles of non-English readings', () => {
    const hebrew = reading('משחקי הכס', { kind: 'book', englishTitle: 'A Game of Thrones' });
    expect(readingAgreement(hebrew, reading('Game of Thrones', { kind: 'book' }))).toBe(1);
  });
});

describe('combineShelfReadings', () => {
  it('puts what both readings found first, merged, then the rest as less sure', () => {
    const combined = combineShelfReadings(
      [reading('Vagabond', { count: 6 }), reading('Black Clover'), reading('Vinland Saga')],
      [
        reading('VINLAND SAGA', { author: 'Makoto Yukimura', count: 11 }),
        reading('Vagabond', { count: 8 }),
        reading('Spider-Man: Gold'),
      ],
    );

    expect(combined).toEqual([
      { kind: 'comic', title: 'Vagabond', count: 8, sure: true },
      // The first reading's text, the author only the second read, the larger count.
      { kind: 'comic', title: 'Vinland Saga', author: 'Makoto Yukimura', count: 11, sure: true },
      { kind: 'comic', title: 'Black Clover', count: 1, sure: false },
      { kind: 'comic', title: 'Spider-Man: Gold', count: 1, sure: false },
    ]);
  });

  it('pairs each reading once', () => {
    const combined = combineShelfReadings(
      [reading('Planet Hulk'), reading('Planet Hulk')],
      [reading('Planet Hulk')],
    );

    expect(combined.map((item) => item.sure)).toEqual([true, false]);
  });

  it('on two real readings of one shelf, is sure only of titles both found', () => {
    const combined = combineShelfReadings(
      readings.first as ShelfReading[],
      readings.second as ShelfReading[],
    );
    const sure = combined.filter((item) => item.sure).map((item) => item.title);

    expect(sure).toEqual(
      expect.arrayContaining(['X-Men: Apocalypse', 'X-Men: Civil War', 'X-Men: Infinity War']),
    );
    // Inventions of one reading only.
    for (const invented of ['Ultramarine', 'Spider-Man: Bold and Brash', 'Infinity Abyss']) {
      expect(combined.find((item) => item.title === invented)?.sure).toBe(false);
    }
    // Nothing is lost.
    expect(combined.length).toBeGreaterThanOrEqual(
      Math.max(readings.first.length, readings.second.length),
    );
  });
});
