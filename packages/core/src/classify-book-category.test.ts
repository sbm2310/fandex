import hobbitSearch from './catalogs/__fixtures__/openlibrary-search-hobbit.json';
import { classifyBookCategory } from './classify-book-category';

// Subject lists and publishers taken from real Open Library records (October 2026).
const tolkienHobbitSubjects = hobbitSearch.docs[0]?.subject ?? [];

describe('classifyBookCategory', () => {
  describe('by publisher (edition-level, checked first)', () => {
    it.each([
      ['SHONEN JUMP', 'manga'],
      ['VIZ Media', 'manga'],
      ['Kodansha Comics', 'manga'],
      ['Yen Press', 'manga'],
      ['DC Comics', 'comic'],
      ['Marvel Worldwide', 'comic'],
      ['Image Comics', 'comic'],
    ] as const)('%s → %s', (publisher, category) => {
      expect(classifyBookCategory({ publisher, subjects: ['Fiction'] })).toBe(category);
    });

    it('ignores publishers that print everything', () => {
      expect(classifyBookCategory({ publisher: 'Del Rey', subjects: ['Fantasy', 'Fiction'] })).toBe(
        'book',
      );
    });
  });

  describe('by subjects', () => {
    it.each([
      [
        'One Piece v1',
        [
          'form:manga',
          'form:manga volume',
          'form:graphic novel',
          'genre:science fantasy',
          'Pirates',
          'Fiction',
          'Adventure',
          'Friendship',
          'Japan',
          'Juvenile fiction',
          'Treasure',
          'Rubber',
        ],
      ],
      ['Cheeky Angel v10', ['Comics & graphic novels, east asian style, manga, general']],
      [
        'Spoof on Titan',
        [
          'Comic books, strips',
          'Comics & graphic novels, manga, science fiction',
          'Humor',
          'Parodies',
        ],
      ],
    ])('%s is manga', (_, subjects) => {
      expect(classifyBookCategory({ subjects })).toBe('manga');
    });

    it.each([
      [
        'Batman: Year One',
        [
          'Graphic novels',
          'Comic books, strips',
          'Comics & graphic novels, superheroes',
          'Fiction, fantasy, general',
          'Crime, fiction',
          'Batman',
          'Gotham City',
          'Police',
          'Corruption',
          'Vigilantes',
          'Superheroes',
          'Fiction',
        ],
      ],
      [
        'Saga v1',
        [
          'Comic books, strips',
          'Comics & graphic novels, science fiction',
          'Space',
          'War',
          'Parents',
          'Love',
          'Fiction',
          'Science fiction',
          'Fantasy',
          'Families',
        ],
      ],
    ])('%s is a comic', (_, subjects) => {
      expect(classifyBookCategory({ subjects })).toBe('comic');
    });

    it('keeps a novel with graphic-novel editions a book (The Hobbit: 4 of 93 subjects)', () => {
      expect(tolkienHobbitSubjects.length).toBeGreaterThan(50);
      expect(classifyBookCategory({ subjects: tolkienHobbitSubjects })).toBe('book');
    });

    it.each([
      [
        'Project Hail Mary',
        ['hard science-fiction', 'Fiction, science fiction, action & adventure'],
      ],
      ['a prose superhero novel', ['Superheroes', 'Fiction']],
      [
        'a book about comics',
        ['Comic books, strips, etc. -- History and criticism', 'Graphic novels -- Bibliography'],
      ],
      ['a book about manga', ['Manga -- History and criticism']],
    ])('%s is a book', (_, subjects) => {
      expect(classifyBookCategory({ subjects })).toBe('book');
    });

    it('counts a comic share right at the threshold (1 in 10)', () => {
      const subjects = ['Graphic novels', ...Array.from({ length: 9 }, (_, i) => `Subject ${i}`)];
      expect(classifyBookCategory({ subjects })).toBe('comic');
      expect(classifyBookCategory({ subjects: [...subjects, 'One more'] })).toBe('book');
    });
  });

  it('defaults to book with nothing to go on', () => {
    expect(classifyBookCategory({})).toBe('book');
    expect(classifyBookCategory({ subjects: [] })).toBe('book');
  });
});
