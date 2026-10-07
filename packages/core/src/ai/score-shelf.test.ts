import { scoreShelfReading, type ExpectedShelfItem } from './score-shelf';
import type { ShelfReading } from './shelf-reading';

const shelf: ExpectedShelfItem[] = [
  { id: 'vinland', kind: 'manga', name: 'Vinland Saga', aliases: ['vinland saga'], count: 11 },
  {
    id: 'big-time',
    kind: 'comic',
    name: 'Spider-Man: Big Time',
    aliases: ['big time'],
    count: 4,
  },
  {
    id: 'hp-he',
    kind: 'book',
    name: 'Harry Potter (Hebrew)',
    aliases: ['הארי פוטר'],
    count: 7,
  },
  {
    id: 'hp-en',
    kind: 'book',
    name: 'Harry Potter box set',
    aliases: ['harry potter'],
    count: 7,
  },
  {
    id: 'falcon',
    kind: 'lego',
    name: 'Millennium Falcon',
    aliases: ['millennium falcon'],
    count: 1,
    setNumber: '75375',
  },
];

const reading = (title: string, extra: Partial<ShelfReading> = {}): ShelfReading => ({
  kind: 'comic',
  title,
  count: 1,
  ...extra,
});

describe('scoreShelfReading', () => {
  it('matches aliases inside longer titles, across book/manga/comic', () => {
    const score = scoreShelfReading(shelf, [
      reading('Spider-Man: Big Time — The Complete Collection'),
      reading('VINLAND SAGA', { kind: 'book' }),
    ]);

    expect(score.found).toEqual(['vinland', 'big-time']);
    expect(score.precision).toBe(1);
    expect(score.recall).toBe(2 / 5);
  });

  it('matches a shortened title that sits inside an alias, but not a tiny one', () => {
    const items: ExpectedShelfItem[] = [
      {
        id: 'iw',
        kind: 'comic',
        name: 'Infinity War',
        aliases: ['the infinity war omnibus'],
        count: 1,
      },
    ];

    expect(scoreShelfReading(items, [reading('Infinity War')]).found).toEqual(['iw']);
    expect(scoreShelfReading(items, [reading('War')]).found).toEqual([]);
  });

  it('sends a Hebrew title to the Hebrew edition and an English one to the English set', () => {
    const score = scoreShelfReading(shelf, [
      reading('הארי פוטר', { kind: 'book', englishTitle: 'Harry Potter' }),
      reading('Harry Potter and the Goblet of Fire', { kind: 'book' }),
    ]);

    expect(score.matches.map((match) => match.itemId)).toEqual(['hp-he', 'hp-en']);
  });

  it('falls back to the English title', () => {
    const score = scoreShelfReading(shelf, [
      reading('ויקינג', { kind: 'manga', englishTitle: 'Vinland Saga' }),
    ]);

    expect(score.found).toEqual(['vinland']);
  });

  it('matches LEGO by set number, and never a book to a set', () => {
    const score = scoreShelfReading(shelf, [
      reading('YT-1300', { kind: 'lego', setNumber: '75375-1' }),
      reading('Millennium Falcon', { kind: 'book' }),
    ]);

    expect(score.matches).toEqual([{ itemId: 'falcon', reading: expect.anything() }]);
    expect(score.unmatched).toHaveLength(1);
  });

  it('counts readings that match nothing against precision', () => {
    const score = scoreShelfReading(shelf, [
      reading('Big Time'),
      reading('Spider-Man: The Daily Bugle'),
    ]);

    expect(score.precision).toBe(0.5);
    expect(score.unmatched.map((entry) => entry.title)).toEqual(['Spider-Man: The Daily Bugle']);
    expect(score.missed).toEqual(['vinland', 'hp-he', 'hp-en', 'falcon']);
  });

  it('handles empty input', () => {
    expect(scoreShelfReading([], [])).toMatchObject({ recall: 1, precision: 1 });
  });
});
