import { collectionUniverseSchema } from '../contracts/universe';
import {
  summarizeCollectionUniverses,
  type UniverseDirectory,
  type UniverseLinkedItem,
} from './summarize-collection';
import { UNIVERSE_SEED } from './universe-seed';

const directory: UniverseDirectory = [
  {
    slug: 'middle-earth',
    name: 'Middle-earth',
    characters: [
      { slug: 'gandalf', name: 'Gandalf' },
      { slug: 'bilbo-baggins', name: 'Bilbo Baggins' },
      { slug: 'frodo-baggins', name: 'Frodo Baggins' },
    ],
  },
  { slug: 'star-wars', name: 'Star Wars', characters: [{ slug: 'yoda', name: 'Yoda' }] },
  { slug: 'dc', name: 'DC', characters: [{ slug: 'batman', name: 'Batman' }] },
];

const item = (overrides: Partial<UniverseLinkedItem>): UniverseLinkedItem => ({
  category: 'book',
  addedAt: '2026-10-01T00:00:00.000Z',
  universes: [],
  characters: [],
  ...overrides,
});

const hobbit = item({
  category: 'book',
  addedAt: '2026-10-01T10:00:00.000Z',
  coverUrl: 'https://covers.example/hobbit.jpg',
  universes: ['middle-earth'],
  characters: [
    { universe: 'middle-earth', character: 'bilbo-baggins' },
    { universe: 'middle-earth', character: 'gandalf' },
  ],
});
const rivendell = item({
  category: 'lego',
  addedAt: '2026-10-03T10:00:00.000Z',
  coverUrl: 'https://cdn.example/rivendell.jpg',
  universes: ['middle-earth'],
  characters: [
    { universe: 'middle-earth', character: 'gandalf' },
    { universe: 'middle-earth', character: 'frodo-baggins' },
  ],
});

describe('summarizeCollectionUniverses', () => {
  it('counts items per universe and category, with characters in directory order', () => {
    const [middleEarth, ...rest] = summarizeCollectionUniverses([hobbit, rivendell], directory);

    expect(rest).toEqual([]);
    expect(middleEarth).toEqual({
      slug: 'middle-earth',
      name: 'Middle-earth',
      itemCount: 2,
      categoryCounts: { book: 1, lego: 1 },
      coverUrls: ['https://cdn.example/rivendell.jpg', 'https://covers.example/hobbit.jpg'],
      characters: [
        { slug: 'gandalf', name: 'Gandalf', itemCount: 2 },
        { slug: 'bilbo-baggins', name: 'Bilbo Baggins', itemCount: 1 },
        { slug: 'frodo-baggins', name: 'Frodo Baggins', itemCount: 1 },
      ],
    });
    expect(collectionUniverseSchema.parse(middleEarth)).toEqual(middleEarth);
  });

  it('lists only universes with items, in directory order', () => {
    const batman = item({ universes: ['dc'], addedAt: '2026-10-05T00:00:00.000Z' });

    const universes = summarizeCollectionUniverses([batman, hobbit], directory);

    expect(universes.map((universe) => universe.slug)).toEqual(['middle-earth', 'dc']);
  });

  it('counts a crossover in each of its universes', () => {
    const crossover = item({ universes: ['star-wars', 'dc'] });

    const universes = summarizeCollectionUniverses([crossover], directory);

    expect(universes.map((universe) => [universe.slug, universe.itemCount])).toEqual([
      ['star-wars', 1],
      ['dc', 1],
    ]);
  });

  it('keeps at most four distinct covers, newest first', () => {
    const items = [1, 2, 3, 4, 5].map((day) =>
      item({
        addedAt: `2026-10-0${day}T00:00:00.000Z`,
        coverUrl: `https://covers.example/${day}.jpg`,
        universes: ['star-wars'],
      }),
    );
    items.push(item({ coverUrl: 'https://covers.example/5.jpg', universes: ['star-wars'] }));

    const [starWars] = summarizeCollectionUniverses(items, directory);

    expect(starWars?.coverUrls).toEqual([5, 4, 3, 2].map((n) => `https://covers.example/${n}.jpg`));
  });

  it("only counts a character under its own universe, and skips ones the directory doesn't know", () => {
    const odd = item({
      universes: ['middle-earth', 'narnia'],
      characters: [
        { universe: 'star-wars', character: 'gandalf' },
        { universe: 'narnia', character: 'aslan' },
      ],
    });

    const universes = summarizeCollectionUniverses([odd], directory);

    expect(universes).toEqual([
      expect.objectContaining({ slug: 'middle-earth', itemCount: 1, characters: [] }),
    ]);
  });

  it('returns nothing for a collection without universe items', () => {
    expect(summarizeCollectionUniverses([item({})], directory)).toEqual([]);
    expect(summarizeCollectionUniverses([], directory)).toEqual([]);
  });

  it('accepts the seed itself as the directory (for guest collections)', () => {
    const universes = summarizeCollectionUniverses([hobbit], UNIVERSE_SEED);

    expect(universes[0]?.characters.map((character) => character.slug)).toEqual([
      'gandalf',
      'bilbo-baggins',
    ]);
  });
});
