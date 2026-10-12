import absoluteBatman3 from '../catalogs/__fixtures__/openlibrary-search-next-absolute-batman-3.json';
import hunterXHunter38 from '../catalogs/__fixtures__/openlibrary-search-next-hunter-x-hunter-38.json';
import jujutsuKaisen27 from '../catalogs/__fixtures__/openlibrary-search-next-jujutsu-kaisen-27.json';
import onePiece114 from '../catalogs/__fixtures__/openlibrary-search-next-one-piece-114.json';
import vagabond38 from '../catalogs/__fixtures__/openlibrary-search-next-vagabond-38.json';
import { OpenLibraryCatalog } from '../catalogs/open-library';
import { findNextVolume, nextVolumeQuery, pickVolume } from './next-volume';
import { parseVolume } from './volumes';

// Real Open Library searches for "the next volume", recorded October 12, 2026.
const responses: Record<string, unknown> = {
  'one piece 114': onePiece114,
  'jujutsu kaisen 27': jujutsuKaisen27,
  'hunter x hunter 38': hunterXHunter38,
  'vagabond 38': vagabond38,
  'absolute batman 3': absoluteBatman3,
};
const catalog = new OpenLibraryCatalog({
  fetch: async (url) => {
    const query = new URL(String(url)).searchParams.get('q')!;
    return Response.json(responses[query] ?? { docs: [] });
  },
});
const search = (query: string) => catalog.search(query);

/** A series as volumeGaps groups it, from one owned title. */
function series(title: string, category: 'manga' | 'comic' = 'manga') {
  const parsed = parseVolume({ category, title })!;
  return { key: parsed.key, category, highest: parsed.volume };
}

describe('findNextVolume', () => {
  it('finds an upcoming volume with its release date', async () => {
    const next = await findNextVolume(series('ONE PIECE 113'), search);

    expect(next).toMatchObject({
      volume: 114,
      entry: { title: 'ONE PIECE 114', publishDate: { date: '2027-02-02', precision: 'day' } },
    });
  });

  it('finds a published one among look-alikes ("Volume 8" for 38, colouring books)', async () => {
    expect(
      (await findNextVolume(series('Hunter × Hunter, Volume 37'), search))?.entry,
    ).toMatchObject({ title: 'Hunter × Hunter, Volume 38' });
    expect((await findNextVolume(series('Jujutsu Kaisen, Vol. 26'), search))?.entry).toMatchObject({
      title: 'Jujutsu Kaisen, Vol. 27',
    });
  });

  it("finds nothing when there's no next volume, or only another series' one", async () => {
    // Vagabond has been on hiatus at volume 37.
    expect(await findNextVolume(series('Vagabond, Volume 37'), search)).toBeNull();
    // Only "Superman/Batman Vol. 3".
    expect(await findNextVolume(series('Absolute Batman, Vol. 2', 'comic'), search)).toBeNull();
  });

  it('searches for the normalized series name and the number', () => {
    expect(nextVolumeQuery(series('Hunter × Hunter, Volume 37'), 38)).toBe('hunter x hunter 38');
    expect(nextVolumeQuery(series('Clara & the Devil, Volume 2', 'comic'), 3)).toBe(
      'clara the devil 3',
    );
  });
});

describe('pickVolume', () => {
  const op = { key: 'one piece', category: 'manga' as const };

  it('reads results as the series category (a volume misfiled as a book still counts)', () => {
    expect(pickVolume(op, 5, [{ category: 'book', title: 'One Piece, Vol. 5' }])).toMatchObject({
      title: 'One Piece, Vol. 5',
    });
  });

  it('prefers the right category, then a known date, then an ISBN', () => {
    const plain = { category: 'book' as const, title: 'One Piece, Vol. 5' };
    const dated = { ...plain, publishDate: { date: '2027-01-01', precision: 'day' } };
    const filed = { category: 'manga' as const, title: 'ONE PIECE 5' };
    expect(pickVolume(op, 5, [plain, dated])).toBe(dated);
    expect(pickVolume(op, 5, [plain, dated, filed])).toBe(filed);
  });
});
