import { describeAnswer, parseQuestionLocally, runCollectionQuery, queryableItem } from './ask';
import { createFigure, figureDetails, trimmed } from './catalog-figure';
import {
  applyItemChanges,
  createCollectionItem,
  InvalidItemChangeError,
  isBookItem,
} from './collection-item';
import { isSameEntry } from './same-book';
import { UNIVERSE_SEED } from './universes/universe-seed';

describe('createFigure', () => {
  it('links the universes and characters its name and line mention', () => {
    const gandalf = createFigure(
      { title: 'Gandalf the Grey', brand: 'Hot Toys', scale: '1/6' },
      { externalId: 'f1' },
    );

    expect(gandalf).toEqual({
      source: 'custom',
      externalId: 'f1',
      category: 'figure',
      title: 'Gandalf the Grey',
      brand: 'Hot Toys',
      scale: '1/6',
      universes: ['middle-earth'],
      characters: [{ universe: 'middle-earth', character: 'gandalf' }],
    });
    // The line counts like a series: "Star Wars" names the universe, not the figure's name.
    expect(
      createFigure({ title: 'Stormtrooper', line: 'Star Wars: A New Hope' }, { externalId: 'f2' })
        .universes,
    ).toEqual(['star-wars']);
  });

  it('stores no links when nothing matches, and drops blank fields', () => {
    const figure = createFigure(
      { title: '  Spartan Warrior ', brand: ' ', line: '', coverUrl: '  ' },
      { externalId: 'f3' },
    );

    expect(figure).toEqual({
      source: 'custom',
      externalId: 'f3',
      category: 'figure',
      title: 'Spartan Warrior',
    });
    expect(trimmed({ title: 'x', scale: ' 1/4 ' })).toEqual({ title: 'x', scale: '1/4' });
  });

  it('describes a figure by brand, number, edition and scale', () => {
    expect(figureDetails({ brand: 'Hot Toys', scale: '1/6' })).toBe('Hot Toys · 1/6');
    expect(figureDetails({ scale: '1/6' })).toBe('1/6');
    expect(figureDetails({})).toBeUndefined();
    expect(figureDetails({ brand: 'Hot Toys', number: 'MMS 279', scale: '1/6' })).toBe(
      'Hot Toys · MMS 279 · 1/6',
    );
    expect(figureDetails({ brand: 'InArt', edition: 'Deluxe', scale: '1/6' })).toBe(
      'InArt · Deluxe · 1/6',
    );
  });
});

describe('figures in the collection', () => {
  const gandalf = createFigure(
    { title: 'Gandalf the Grey', brand: 'Hot Toys' },
    { externalId: 'f1' },
  );
  const item = createCollectionItem(gandalf, { id: '1', now: new Date('2026-10-11T10:00:00Z') });

  it('is the same figure only by its id (two Gandalfs are two figures)', () => {
    const another = createFigure({ title: 'Gandalf the Grey' }, { externalId: 'f2' });
    expect(isSameEntry(gandalf, { ...gandalf })).toBe(true);
    expect(isSameEntry(gandalf, another)).toBe(false);
  });

  it("keeps its category: a figure isn't a book", () => {
    expect(item.category).toBe('figure');
    expect(isBookItem(item)).toBe(false);
    expect(() => applyItemChanges(item, { category: 'comic' })).toThrow(InvalidItemChangeError);
  });

  it('is found by "Ask": its brand counts as its maker', () => {
    expect(queryableItem(item)).toMatchObject({ category: 'figure', creators: ['Hot Toys'] });

    const query = parseQuestionLocally('Which figures do I have?');
    expect(query.categories).toEqual(['figure']);
    expect(describeAnswer(query, runCollectionQuery([item], query), UNIVERSE_SEED)).toBe(
      'You own 1 figure.',
    );
  });
});
