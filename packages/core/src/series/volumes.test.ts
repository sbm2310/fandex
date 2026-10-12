import type { Category } from '../category';
import { formatVolumeRanges, parseVolume, volumeGaps } from './volumes';

// Real Open Library titles (and subtitles), recorded October 2026.
const manga = (title: string, subtitle?: string) => ({
  category: 'manga' as Category,
  title,
  subtitle,
});
const comic = (title: string, subtitle?: string) => ({
  category: 'comic' as Category,
  title,
  subtitle,
});

describe('parseVolume', () => {
  it.each([
    [manga("One Piece, Vol. 24: People's Dreams", '人の夢'), 'One Piece', 24],
    [manga('Hunter × Hunter, Volume 7', 'これから'), 'Hunter × Hunter', 7],
    [manga('Jujutsu Kaisen, Vol. 26'), 'Jujutsu Kaisen', 26],
    [manga('Chainsaw Man, Vol. 22'), 'Chainsaw Man', 22],
    [comic('Ultimate X Men, Vol. 10', 'Cry Wolf'), 'Ultimate X Men', 10],
    [comic('New Avengers Vol. 4', 'The Collective'), 'New Avengers', 4],
    [comic('Absolute Batman, Vol. 2'), 'Absolute Batman', 2],
    [comic('Batman (2025-) #5'), 'Batman (2025-)', 5],
    [comic('Clara & the Devil, Volume 2'), 'Clara & the Devil', 2],
  ])('reads a named volume: %o', (entry, series, volume) => {
    expect(parseVolume(entry)).toMatchObject({ series, volume });
  });

  it.each([
    [manga('ONE PIECE 113', 'The Birth of Loki'), 'ONE PIECE', 113],
    [manga('葬送のフリーレン 15'), '葬送のフリーレン', 15],
    [manga('Oyayubihime Infinity', 'Volume 6 (Oyayubihime Infinity)'), 'Oyayubihime Infinity', 6],
  ])('reads a manga number at the end, or in the subtitle: %o', (entry, series, volume) => {
    expect(parseVolume(entry)).toMatchObject({ series, volume });
  });

  it.each([
    // Part of the name, not a volume (comics don't use a bare trailing number).
    comic('Spider-Man 2099', 'Apocalypse soon'),
    comic('Marvel Universe Ultimate Spider-Man Comic Reader 3'),
    // Several volumes in one.
    manga('Jujutsu Kaisen Series Vol. 19-24, 6 Books Collection Set'),
    manga('Chainsaw Man Collection 13 Book Set', 'Box Set'),
    // No number.
    comic('Hulk', 'Planet Hulk Omnibus'),
    manga('Akira'),
    // Not a plausible volume.
    manga('Vagabond 0'),
    manga('Detective Conan 2026'),
  ])('reads no volume in %o', (entry) => {
    expect(parseVolume(entry)).toBeNull();
  });

  it('leaves books and LEGO to other sources', () => {
    expect(parseVolume({ category: 'book', title: 'The Stormlight Archive, Vol. 2' })).toBeNull();
    expect(parseVolume({ category: 'lego', title: 'UCS Volume 2' })).toBeNull();
  });

  it('groups spellings of one series under one key', () => {
    const keys = [
      manga('ONE PIECE 113'),
      manga('One Piece, Vol. 24'),
      manga('One piece vol 3'),
    ].map((entry) => parseVolume(entry)?.key);
    expect(new Set(keys)).toEqual(new Set(['one piece']));
    expect(parseVolume(comic('The New Avengers Volume 1'))?.key).toBe(
      parseVolume(comic('New Avengers Vol. 4'))?.key,
    );
    expect(parseVolume(manga('Hunter x Hunter, Volume 1'))?.key).toBe(
      parseVolume(manga('Hunter × Hunter, Volume 7'))?.key,
    );
  });
});

describe('volumeGaps', () => {
  const owned = [
    { id: 'a', ...manga('One Piece, Vol. 1') },
    { id: 'b', ...manga('ONE PIECE 3') },
    { id: 'c', ...manga('One Piece, Vol. 5') },
    { id: 'd', ...manga('One Piece, Vol. 5') }, // a second copy
    { id: 'e', ...comic('Absolute Batman, Vol. 2') },
    { id: 'f', ...manga('Akira') },
    { id: 'g', ...comic('Hulk', 'Planet Hulk Omnibus') },
  ];

  it("lists each series' owned and missing volumes, from 1 to the highest owned", () => {
    const [batman, onePiece, ...rest] = volumeGaps(owned);

    expect(rest).toEqual([]);
    expect(onePiece).toMatchObject({
      key: 'one piece',
      name: 'One Piece',
      category: 'manga',
      owned: [1, 3, 5],
      missing: [2, 4],
      highest: 5,
    });
    expect(onePiece!.items.get(5)!.map((item) => item.id)).toEqual(['c', 'd']);
    expect(batman).toMatchObject({ name: 'Absolute Batman', owned: [2], missing: [1] });
  });

  it('keeps a manga and a comic of the same name apart', () => {
    const series = volumeGaps([manga('X, Vol. 1'), comic('X, Vol. 2')]);
    expect(series.map((s) => [s.category, s.owned])).toEqual([
      ['comic', [2]],
      ['manga', [1]],
    ]);
  });

  it('has nothing to say without numbered volumes', () => {
    expect(volumeGaps([manga('Akira'), comic('Watchmen')])).toEqual([]);
  });
});

describe('formatVolumeRanges', () => {
  it('joins runs into ranges', () => {
    expect(formatVolumeRanges([4])).toBe('4');
    expect(formatVolumeRanges([2, 4])).toBe('2 and 4');
    expect(formatVolumeRanges([1, 2, 3, 5, 7, 8, 9])).toBe('1–3, 5 and 7–9');
    expect(formatVolumeRanges(Array.from({ length: 112 }, (_, i) => i + 1))).toBe('1–112');
    expect(formatVolumeRanges([])).toBe('');
  });
});
