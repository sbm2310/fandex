import { applyLinkEdits, diffLinks, type ItemLinks } from './link-edits';

const gandalf = { universe: 'middle-earth', character: 'gandalf' };
const bilbo = { universe: 'middle-earth', character: 'bilbo-baggins' };
const frodo = { universe: 'middle-earth', character: 'frodo-baggins' };
const yoda = { universe: 'star-wars', character: 'yoda' };

const automatic: ItemLinks = { universes: ['middle-earth'], characters: [gandalf, bilbo] };

describe('applyLinkEdits', () => {
  it('returns the automatic links when there are no edits', () => {
    expect(applyLinkEdits(automatic)).toEqual(automatic);
  });

  it('adds and removes universes and characters', () => {
    expect(
      applyLinkEdits(automatic, {
        addedUniverses: ['star-wars'],
        addedCharacters: [yoda, frodo],
        removedCharacters: [bilbo],
      }),
    ).toEqual({ universes: ['middle-earth', 'star-wars'], characters: [gandalf, yoda, frodo] });
  });

  it("drops a universe's characters along with it", () => {
    expect(applyLinkEdits(automatic, { removedUniverses: ['middle-earth'] })).toEqual({
      universes: [],
      characters: [],
    });
  });

  it('ignores additions that are already there', () => {
    expect(
      applyLinkEdits(automatic, { addedCharacters: [gandalf], addedUniverses: ['middle-earth'] }),
    ).toEqual(automatic);
  });
});

describe('diffLinks', () => {
  it('is undefined when nothing changed (in any order)', () => {
    expect(
      diffLinks(automatic, { universes: ['middle-earth'], characters: [bilbo, gandalf] }),
    ).toBeUndefined();
  });

  it('records only the differences', () => {
    expect(
      diffLinks(automatic, {
        universes: ['middle-earth', 'star-wars'],
        characters: [gandalf, yoda],
      }),
    ).toEqual({
      addedUniverses: ['star-wars'],
      addedCharacters: [yoda],
      removedCharacters: [bilbo],
    });
  });

  it("counts a wanted character's universe as wanted", () => {
    expect(
      diffLinks(automatic, { universes: ['middle-earth'], characters: [gandalf, bilbo, yoda] }),
    ).toEqual({
      addedUniverses: ['star-wars'],
      addedCharacters: [yoda],
    });
  });

  it("doesn't separately remove the characters of a removed universe", () => {
    expect(diffLinks(automatic, { universes: [], characters: [] })).toEqual({
      removedUniverses: ['middle-earth'],
    });
  });

  it('round-trips: applying the diff gives the wanted links', () => {
    const wanted: ItemLinks = {
      universes: ['star-wars', 'middle-earth'],
      characters: [frodo, yoda],
    };
    const result = applyLinkEdits(automatic, diffLinks(automatic, wanted));
    expect(new Set(result.universes)).toEqual(new Set(wanted.universes));
    expect(result.characters).toEqual(expect.arrayContaining(wanted.characters));
    expect(result.characters).toHaveLength(2);
  });
});
