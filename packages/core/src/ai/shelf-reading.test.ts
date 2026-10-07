import replies from './__fixtures__/shelf-replies.json';
import { isGenericTitle, normalizeReading, parseShelfReply, shelfPrompt } from './shelf-reading';

// shelf-replies.json holds real replies from qwen/qwen3.8-27b on the owner's shelf photos.

describe('parseShelfReply', () => {
  it('reads one item per line, with "-" meaning none', () => {
    const { readings } = parseShelfReply(
      [
        'manga | Vagabond | - | Takehiko Inoue | 8 | -',
        'book | הארי פוטר | Harry Potter | ג׳יי קיי רולינג | 7 | -',
        'lego | Millennium Falcon | - | - | 1 | 75375',
      ].join('\n'),
    );

    expect(readings).toEqual([
      { kind: 'manga', title: 'Vagabond', author: 'Takehiko Inoue', count: 8 },
      {
        kind: 'book',
        title: 'הארי פוטר',
        englishTitle: 'Harry Potter',
        author: 'ג׳יי קיי רולינג',
        count: 7,
      },
      { kind: 'lego', title: 'Millennium Falcon', count: 1, setNumber: '75375' },
    ]);
  });

  it('skips prose, unknown kinds and empty titles, and tolerates a missing last field', () => {
    const { readings, droppedLines } = parseShelfReply(
      [
        'Here is the catalogue:',
        '',
        '- comic | Planet Hulk | - | - | 1',
        'figure | Gandalf | - | - | 1 | -',
        'book | - | - | - | 1 | -',
      ].join('\n'),
    );

    expect(readings).toEqual([{ kind: 'comic', title: 'Planet Hulk', count: 1 }]);
    expect(droppedLines).toBe(2);
  });

  it('drops publisher-only titles', () => {
    const { readings } = parseShelfReply(
      'comic | MARVEL | - | - | 1 | -\ncomic | THE COMPLETE COLLECTION | - | - | 7 | -',
    );

    expect(readings).toEqual([]);
  });

  it('merges repeated lines, keeping the higher spine count', () => {
    const { readings, droppedLines } = parseShelfReply(
      'manga | Demon Slayer | - | - | 14 | -\nmanga | DEMON SLAYER | - | - | 9 | -',
    );

    expect(readings).toEqual([{ kind: 'manga', title: 'Demon Slayer', count: 14 }]);
    expect(droppedLines).toBe(1);
  });

  it('survives a reply where the model looped', () => {
    const { readings, droppedLines } = parseShelfReply(replies.looping);
    const titles = readings.map((reading) => reading.title);

    // 50+ lines, mostly two titles alternating: each is kept once.
    expect(titles.filter((title) => title === 'Spider-Man: The Daily Bugle')).toHaveLength(1);
    expect(titles).toContain('Civil War');
    expect(droppedLines).toBeGreaterThan(25);
  });

  it('reads a well-formed reply in full', () => {
    const { readings } = parseShelfReply(replies.bottomShelf);

    expect(readings).toHaveLength(17); // 18 lines, one publisher-only
    expect(readings).toContainEqual({ kind: 'comic', title: 'SPIDER-MAN: BIG TIME', count: 6 });
  });

  it('ignores an English title equal to the printed one, and odd set numbers', () => {
    const { readings } = parseShelfReply(
      'book | Oathbringer | Oathbringer | Brandon Sanderson | 1 | -\nlego | X-Wing | - | - | 1 | n/a',
    );

    expect(readings).toEqual([
      { kind: 'book', title: 'Oathbringer', author: 'Brandon Sanderson', count: 1 },
      { kind: 'lego', title: 'X-Wing', count: 1 },
    ]);
  });

  it('treats a missing or silly spine count as one', () => {
    const { readings } = parseShelfReply('book | Dune | - | - | lots | -\nbook | Emma | - | - | 0');

    expect(readings.map((reading) => reading.count)).toEqual([1, 1]);
  });
});

describe('normalizeReading', () => {
  it('keeps letters of any script and drops punctuation', () => {
    expect(normalizeReading('Spider-Man: Big Time')).toBe('spider man big time');
    expect(normalizeReading("ג'ורג' ר.ר. מרטין")).toBe('גורג ר ר מרטין');
    expect(normalizeReading('Pokémon')).toBe('pokemon');
  });
});

describe('isGenericTitle', () => {
  it('knows publishers and formats', () => {
    expect(isGenericTitle('Marvel Omnibus')).toBe(true);
    expect(isGenericTitle('VIZ')).toBe(true);
    expect(isGenericTitle('Star Wars')).toBe(false);
  });
});

describe('shelfPrompt', () => {
  it('mentions the parts only when the photo was cut', () => {
    expect(shelfPrompt(1)).not.toContain('parts of one photo');
    expect(shelfPrompt(2)).toContain('The 2 images are parts of one photo');
  });
});
