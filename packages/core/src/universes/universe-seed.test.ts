import themesFixture from '../catalogs/__fixtures__/rebrickable-themes.json';
import { normalizeName, normalizeText } from './normalize-name';
import { UNIVERSE_SEED, findCharacter, findUniverse } from './universe-seed';

// The seed is hand-edited data, so these tests guard its shape rather than its content.

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const WIKIDATA_ID = /^Q[1-9]\d*$/;

describe('UNIVERSE_SEED', () => {
  it('has unique, URL-safe universe slugs and Wikidata ids', () => {
    const slugs = UNIVERSE_SEED.map((universe) => universe.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const universe of UNIVERSE_SEED) {
      expect(universe.slug).toMatch(SLUG);
      expect(universe.wikidataId).toMatch(WIKIDATA_ID);
    }
  });

  it('has unique, URL-safe character slugs within each universe', () => {
    for (const universe of UNIVERSE_SEED) {
      const slugs = universe.characters.map((character) => character.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
      for (const slug of slugs) expect(slug).toMatch(SLUG);
    }
  });

  it('gives every character a distinct Wikidata id', () => {
    const ids = UNIVERSE_SEED.flatMap((universe) => universe.characters.map((c) => c.wikidataId));
    for (const id of ids) expect(id).toMatch(WIKIDATA_ID);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only lists LEGO themes that exist on Rebrickable', () => {
    const themeIds = new Set(themesFixture.results.map((theme) => theme.id));
    for (const universe of UNIVERSE_SEED)
      for (const id of universe.legoThemeIds) expect(themeIds).toContain(id);
  });

  it('never uses the same title phrase for two universes', () => {
    const owners = new Map<string, string>();
    for (const universe of UNIVERSE_SEED) {
      const phrases = [
        ...universe.titleAliases,
        ...universe.characters.flatMap((character) => character.titleNames ?? []),
      ].map(normalizeText);
      for (const phrase of phrases) {
        expect([phrase, owners.get(phrase) ?? universe.slug]).toEqual([phrase, universe.slug]);
        owners.set(phrase, universe.slug);
      }
    }
  });

  it("doesn't give an ambiguous character title names", () => {
    for (const universe of UNIVERSE_SEED)
      for (const character of universe.characters)
        if (character.ambiguous) expect(character.titleNames).toBeUndefined();
  });

  it('has no empty names', () => {
    for (const universe of UNIVERSE_SEED)
      for (const character of universe.characters)
        for (const name of [character.name, ...(character.aliases ?? [])])
          expect(normalizeName(name)).not.toBe('');
  });
});

describe('findUniverse / findCharacter', () => {
  it('finds seed entries by slug', () => {
    expect(findUniverse('star-wars')?.name).toBe('Star Wars');
    expect(findCharacter('middle-earth', 'gandalf')?.name).toBe('Gandalf');
  });

  it('returns undefined for unknown slugs, or a character asked for in the wrong universe', () => {
    expect(findUniverse('narnia')).toBeUndefined();
    expect(findCharacter('middle-earth', 'aslan')).toBeUndefined();
    expect(findCharacter('star-wars', 'gandalf')).toBeUndefined();
  });
});
