import { figureFromSeed } from '../figures/figure-seed-entry';
import { FIGURE_SEED } from '../figures/figure-seed';
import { matchBoxReading } from './box-matching';
import { boxPrompt, boxReadingFigure, parseBoxReply } from './box-reading';
import { scoreBoxReading } from './score-box';

const catalog = FIGURE_SEED.map((entry) => {
  const figure = figureFromSeed(entry);
  return { ...figure, universes: figure.universes ?? [], characters: figure.characters ?? [] };
});
const ids = (reading: Parameters<typeof matchBoxReading>[0]) =>
  matchBoxReading(reading, catalog).map(({ figure, by }) => `${figure.externalId} (${by})`);

describe('boxPrompt', () => {
  it('asks for labelled lines, and says when several photos show one box', () => {
    expect(boxPrompt()).toContain('number: the product code printed on the box');
    expect(boxPrompt()).not.toContain('sides of the same box');
    expect(boxPrompt(2)).toContain('The 2 images are different sides of the same box.');
  });
});

describe('parseBoxReply', () => {
  it('reads the labelled lines, writing brand, number and scale our way', () => {
    const reply = `brand: HOT TOYS
line: Movie Masterpiece Series
number: MMS279
name: Darth Vader
character: Darth Vader
from: Star Wars: A New Hope
scale: 1/6th scale
edition: -`;
    expect(parseBoxReply(reply)).toEqual({
      brand: 'Hot Toys',
      line: 'Movie Masterpiece Series',
      number: 'MMS 279',
      name: 'Darth Vader',
      character: 'Darth Vader',
      from: 'Star Wars: A New Hope',
      scale: '1/6',
    });
  });

  it('copes with markdown, prose around the lines, and repeated or unknown labels', () => {
    const reply = `Here is what I can read:
- **Brand:** InArt
* **Name**: Gandalf the Grey
**character:** Gandalf
name: Gandalf the White
price: $445
number: not visible
Hope this helps!`;
    expect(parseBoxReply(reply)).toEqual({
      brand: 'InArt',
      name: 'Gandalf the Grey',
      character: 'Gandalf',
    });
  });

  it('keeps a code it does not know as read, and finds a known one inside text', () => {
    expect(parseBoxReply('name: Michael Jackson\nnumber: A012')?.number).toBe('A012');
    expect(parseBoxReply('name: Joker\nnumber: Product code DX32')?.number).toBe('DX 32');
  });

  it('gives up when nothing identifies the figure', () => {
    expect(parseBoxReply('brand: Hot Toys\nscale: 1/6')).toBeNull();
    expect(parseBoxReply("I can't read this box.")).toBeNull();
  });
});

describe('matchBoxReading on the curated list', () => {
  it('finds exactly the figure a box number names', () => {
    expect(ids({ number: 'MMS 279', name: 'Darth Vader' })).toEqual(['hot-toys-mms-279 (number)']);
    // The die-cast count is part of the box code, not of the figure's number.
    expect(ids({ number: 'MMS 528 D30' })).toEqual(['hot-toys-mms-528 (number)']);
  });

  it('falls back to the name when no figure has the number read (models misread digits)', () => {
    expect(ids({ number: 'MMS 2790', name: 'Gandalf the Grey', brand: 'InArt' })[0]).toBe(
      'inart-gandalf-the-grey (name)',
    );
  });

  it('prefers the maker, edition and scale read on the box', () => {
    expect(ids({ name: 'Batman', from: 'The Batman', brand: 'Hot Toys' })[0]).toMatch(/^hot-toys-/);
    expect(ids({ name: 'Draco Malfoy', brand: 'InArt', edition: 'Deluxe' })[0]).toBe(
      'inart-draco-malfoy-deluxe (name)',
    );
    expect(ids({ name: 'Batman The Dark Knight Rises', scale: '1/12', brand: 'InArt' })[0]).toBe(
      'inart-batman-the-dark-knight-rises-1-12 (name)',
    );
  });

  it('tries the character when the printed name finds nothing', () => {
    expect(ids({ name: 'The Grey Pilgrim', character: 'Gandalf' })).toEqual([
      'inart-gandalf-the-grey (name)',
    ]);
    expect(ids({ name: 'Spartan Warrior' })).toEqual([]);
  });

  it('suggests a figure to add by hand when the catalog lacks it', () => {
    expect(
      boxReadingFigure({
        brand: 'Hot Toys',
        number: 'MMS 999',
        name: 'Boba Fett',
        from: 'Return of the Jedi',
        scale: '1/6',
      }),
    ).toEqual({
      title: 'Boba Fett (Return of the Jedi)',
      brand: 'Hot Toys',
      number: 'MMS 999',
      scale: '1/6',
    });
    // The character stands in for a missing name; a film the name already gives isn't repeated.
    expect(boxReadingFigure({ character: 'Gandalf', from: 'The Lord of the Rings' }).title).toBe(
      'Gandalf (The Lord of the Rings)',
    );
    expect(boxReadingFigure({ name: 'The Batman - Batman', from: 'The Batman' }).title).toBe(
      'The Batman - Batman',
    );
  });
});

describe('scoreBoxReading', () => {
  const expected = {
    file: 'vader.jpeg',
    brand: 'Hot Toys',
    number: 'MMS279',
    name: 'Darth Vader',
    figureId: 'hot-toys-mms-279',
  };

  it('checks brand, number, name and where the right figure came', () => {
    const reading = parseBoxReply('brand: Hot Toys\nnumber: MMS 279\nname: Darth Vader');
    expect(scoreBoxReading(reading, expected, ['hot-toys-mms-279'])).toEqual({
      read: true,
      brand: true,
      number: true,
      name: true,
      match: 'first',
    });
    expect(scoreBoxReading(reading, expected, ['x', 'hot-toys-mms-279']).match).toBe('listed');
  });

  it('counts misreadings and figures the catalog lacks', () => {
    const misread = parseBoxReply('brand: Sideshow\nnumber: MMS 297\nname: Lord Vader');
    expect(scoreBoxReading(misread, expected, [])).toEqual({
      read: true,
      brand: false,
      number: false,
      name: false,
      match: 'missed',
    });
    expect(
      scoreBoxReading(null, { file: 'other.jpeg', brand: 'InArt', name: 'Spartan Warrior' }, []),
    ).toEqual({ read: false, brand: false, number: null, name: false, match: null });
  });
});
