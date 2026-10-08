import type { CatalogBook } from '../catalog-book';
import type { CatalogSet } from '../catalog-set';
import type { BookCategory } from '../category';
import type { CollectionItem } from '../collection-item';
import type { CharacterRef } from '../universes/match-universes';
import { UNIVERSE_SEED } from '../universes/universe-seed';

import { checkQuery, collectionQuery, runCollectionQuery } from './collection-query';
import { describeAnswer } from './describe-answer';
import { parseQuestionLocally } from './parse-question';

// A sample collection across categories and universes, added over a few months.
type Links = { universes?: string[]; characters?: CharacterRef[] };
const ref = (universe: string, character: string): CharacterRef => ({ universe, character });
let nextId = 0;

function book(
  title: string,
  category: BookCategory,
  addedAt: string,
  { authors = [], ...links }: Links & { authors?: string[] } = {},
): Extract<CollectionItem, { catalog: CatalogBook }> {
  const catalog: CatalogBook = {
    source: 'openlibrary',
    externalId: `OL${++nextId}M`,
    category,
    title,
    authors,
    ...links,
  };
  return { id: String(nextId), category, catalog, addedAt: `${addedAt}T12:00:00.000Z` };
}

function set(title: string, setNumber: string, addedAt: string, links: Links = {}): CollectionItem {
  const catalog: CatalogSet = {
    source: 'rebrickable',
    externalId: `${setNumber}-1`,
    category: 'lego',
    title,
    setNumber,
    ...links,
  };
  return { id: String(++nextId), category: 'lego', catalog, addedAt: `${addedAt}T12:00:00.000Z` };
}

const dc = { universes: ['dc'] };
const collection: CollectionItem[] = [
  book('Batman: Year One', 'comic', '2026-09-01', {
    ...dc,
    authors: ['Frank Miller'],
    characters: [ref('dc', 'batman')],
  }),
  book('Batman: The Killing Joke', 'comic', '2026-10-02', {
    ...dc,
    authors: ['Alan Moore'],
    characters: [ref('dc', 'batman'), ref('dc', 'joker')],
  }),
  set('Batmobile Tumbler', '76240', '2026-10-05', { ...dc, characters: [ref('dc', 'batman')] }),
  book('Superman: Red Son', 'comic', '2026-08-01', {
    ...dc,
    authors: ['Mark Millar'],
    characters: [ref('dc', 'superman')],
  }),
  book('The Way of Kings', 'book', '2026-07-01', { authors: ['Brandon Sanderson'] }),
  book('Words of Radiance', 'book', '2026-07-01', { authors: ['Brandon Sanderson'] }),
  book('Vagabond, Vol. 1', 'manga', '2026-10-06', { authors: ['Takehiko Inoue'] }),
  set('Millennium Falcon', '75375', '2026-10-07', {
    universes: ['star-wars'],
    characters: [ref('star-wars', 'han-solo'), ref('star-wars', 'chewbacca')],
  }),
  book('The Hobbit', 'book', '2025-12-20', {
    universes: ['middle-earth'],
    authors: ['J. R. R. Tolkien'],
    characters: [ref('middle-earth', 'bilbo-baggins'), ref('middle-earth', 'gandalf')],
  }),
  book("Harry Potter and the Philosopher's Stone", 'book', '2026-10-08', {
    universes: ['wizarding-world'],
    authors: ['J. K. Rowling'],
    characters: [ref('wizarding-world', 'harry-potter')],
  }),
];
// The user linked Watchmen to DC by hand, and filed a manga-looking trade as a comic.
const watchmen: CollectionItem = {
  ...book('Watchmen', 'comic', '2026-06-01', { authors: ['Alan Moore'] }),
  linkEdits: { addedUniverses: ['dc'] },
};
const refiled: CollectionItem = {
  ...book('Akira, Vol. 1', 'manga', '2026-06-02', { authors: ['Katsuhiro Otomo'] }),
  category: 'comic',
};
collection.push(watchmen, refiled);

const titles = (items: readonly CollectionItem[]) => items.map((item) => item.catalog.title);
const today = new Date('2026-10-08T09:00:00Z');

/** Question → query (keyword fallback) → answer, as the Ask screen will do without the AI. */
function ask(question: string) {
  const query = parseQuestionLocally(question, { today });
  const result = runCollectionQuery(collection, query);
  return { query, result, text: describeAnswer(query, result, UNIVERSE_SEED) };
}

describe('runCollectionQuery', () => {
  it('matches any value within a filter, and every filter', () => {
    const result = runCollectionQuery(
      collection,
      collectionQuery({ characters: [ref('dc', 'batman')], categories: ['comic', 'lego'] }),
    );

    expect(titles(result.items)).toEqual([
      'Batmobile Tumbler',
      'Batman: The Killing Joke',
      'Batman: Year One',
    ]);
    expect(result.categoryCounts).toEqual({ comic: 2, lego: 1 });
  });

  it("uses the user's fixes: links added by hand, and corrected categories", () => {
    const dcComics = runCollectionQuery(
      collection,
      collectionQuery({ universes: ['dc'], categories: ['comic'], sort: 'title' }),
    );
    expect(titles(dcComics.items)).toContain('Watchmen');

    const manga = runCollectionQuery(collection, collectionQuery({ categories: ['manga'] }));
    expect(titles(manga.items)).toEqual(['Vagabond, Vol. 1']); // Akira was refiled as a comic
  });

  it('filters by title words, author and when items were added', () => {
    const run = (input: Parameters<typeof collectionQuery>[0]) =>
      titles(runCollectionQuery(collection, collectionQuery({ sort: 'title', ...input })).items);

    expect(run({ titleWords: ['batman'] })).toEqual([
      'Batman: The Killing Joke',
      'Batman: Year One',
    ]);
    expect(run({ titleWords: ['KINGS', 'way'] })).toEqual(['The Way of Kings']);
    expect(run({ creator: 'sanderson' })).toEqual(['The Way of Kings', 'Words of Radiance']);
    expect(run({ creator: 'Moore' })).toEqual(['Batman: The Killing Joke', 'Watchmen']);
    expect(run({ addedAfter: '2026-10-06', addedBefore: '2026-10-08' })).toEqual([
      'Millennium Falcon',
      'Vagabond, Vol. 1',
    ]);
  });

  it('sorts by title the way a bookshop does', () => {
    const result = runCollectionQuery(
      collection,
      collectionQuery({ universes: ['middle-earth', 'wizarding-world'], sort: 'title' }),
    );
    expect(titles(result.items)).toEqual([
      "Harry Potter and the Philosopher's Stone",
      'The Hobbit',
    ]);
  });
});

describe('checkQuery', () => {
  it('drops universes and characters Fandex does not know, and says which', () => {
    const { query, unknown } = checkQuery(
      collectionQuery({
        universes: ['dc', 'batman-universe'],
        characters: [ref('dc', 'batman'), ref('marvel', 'batman')],
      }),
      UNIVERSE_SEED,
    );

    expect(query.universes).toEqual(['dc']);
    expect(query.characters).toEqual([ref('dc', 'batman')]);
    expect(unknown).toEqual(['batman-universe', 'marvel/batman']);
  });
});

describe('describeAnswer', () => {
  const describe_ = (input: Parameters<typeof collectionQuery>[0], unknown: string[] = []) => {
    const query = collectionQuery(input);
    return describeAnswer(query, runCollectionQuery(collection, query), UNIVERSE_SEED, unknown);
  };

  it('counts, with a breakdown when categories are mixed', () => {
    expect(describe_({ characters: [ref('dc', 'batman')] })).toBe(
      'You own 3 Batman items: 2 comics and 1 LEGO set.',
    );
    expect(describe_({ universes: ['star-wars'], categories: ['lego'] })).toBe(
      'You own 1 Star Wars LEGO set.',
    );
    expect(describe_({})).toBe(
      'You own 12 items: 4 books, 1 manga volume, 5 comics and 2 LEGO sets.',
    );
  });

  it('names authors, title words and dates', () => {
    expect(describe_({ creator: 'Brandon Sanderson', categories: ['book'] })).toBe(
      'You own 2 books by Brandon Sanderson.',
    );
    expect(describe_({ titleWords: ['batman'] })).toBe(
      'You own 2 items with “batman” in the title.',
    );
    expect(describe_({ universes: ['dc'], addedAfter: '2026-10-01' })).toBe(
      'You own 2 DC items added since October 1, 2026: 1 comic and 1 LEGO set.',
    );
  });

  it('says when nothing matches, or what it left out', () => {
    expect(describe_({ universes: ['marvel'], categories: ['lego'] })).toBe(
      "You don't own any Marvel LEGO sets yet.",
    );
    expect(describe_({ universes: ['dc'], categories: ['manga'] }, ['batman-universe'])).toBe(
      "You don't own any DC manga volumes yet. (Fandex doesn't know “batman-universe”, so it was left out.)",
    );
  });

  it('explains a question it cannot answer', () => {
    expect(describe_({ unsupported: "pre-orders aren't tracked yet." })).toBe(
      "I can't answer that yet: pre-orders aren't tracked yet.",
    );
  });
});

describe('parseQuestionLocally, on the roadmap questions', () => {
  it('“What Batman stuff do I own?”', () => {
    const { query, text } = ask('What Batman stuff do I own?');

    expect(query).toMatchObject({
      characters: [ref('dc', 'batman')],
      universes: [],
      answer: 'list',
    });
    expect(text).toBe('You own 3 Batman items: 2 comics and 1 LEGO set.');
  });

  it('“Which manga series am I missing volumes of?” — not yet', () => {
    expect(ask('Which manga series am I missing volumes of?').text).toMatch(
      /^I can't answer that yet: .*which volumes a series has/,
    );
  });

  it("“What's arriving this month?” — not yet", () => {
    expect(ask("What's arriving this month?").text).toMatch(/pre-orders and release dates/);
  });
});

describe('parseQuestionLocally', () => {
  it('reads universes, categories and "how many"', () => {
    expect(ask('How many Star Wars LEGO sets do I have?')).toMatchObject({
      query: { universes: ['star-wars'], categories: ['lego'], answer: 'count' },
      text: 'You own 1 Star Wars LEGO set.',
    });
    expect(ask('Show me my DC comics and graphic novels').query).toMatchObject({
      universes: ['dc'],
      categories: ['comic'], // "graphic novels" isn't "novels"
    });
    expect(ask('Do I have any Tolkien books?').query.universes).toEqual(['middle-earth']);
  });

  it('prefers the universe when a phrase is both ("Harry Potter books")', () => {
    expect(ask('Which Harry Potter books do I have?').query).toMatchObject({
      universes: ['wizarding-world'],
      characters: [],
      categories: ['book'],
    });
  });

  it('reads characters by their other names, and leaves their universe implied', () => {
    expect(ask('Anything with Han Solo or Chewie?').query).toMatchObject({
      universes: [],
      characters: [ref('star-wars', 'han-solo'), ref('star-wars', 'chewbacca')],
    });
    expect(ask('My Star Wars stuff with Darth Vader').query).toMatchObject({
      universes: [],
      characters: [ref('star-wars', 'darth-vader')],
    });
  });

  it('ignores names that are everyday words', () => {
    expect(ask('Which of my books are for my child?').query.characters).toEqual([]);
  });

  it('reads simple dates relative to today', () => {
    expect(ask('What did I add this month?')).toMatchObject({
      query: { addedAfter: '2026-10-01' },
      text: 'You own 5 items added since October 1, 2026: 1 book, 1 manga volume, 1 comic and 2 LEGO sets.',
    });
    expect(ask('What did I add last month?').query).toMatchObject({
      addedAfter: '2026-09-01',
      addedBefore: '2026-10-01',
    });
    expect(ask('Books added this week').query.addedAfter).toBe('2026-10-05'); // a Monday
  });

  it('answers questions about the whole collection', () => {
    expect(ask('How many items do I have?').text).toMatch(/^You own 12 items/);
    expect(ask('What do I own?').query.answer).toBe('list');
  });

  it('asks for a universe, character or category when it recognizes nothing', () => {
    expect(ask('Tell me something nice').text).toMatch(/couldn't tell what to look for/);
  });
});
