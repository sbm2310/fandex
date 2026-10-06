import fixtures from './__fixtures__/signals.json';
import type { MatchSignals } from './match-signals';
import { matchUniverses } from './match-universes';
import type { UniverseSeed } from './universe-seed';

// signals.json holds real data recorded from Open Library and Rebrickable (October 2026):
// each entry's `recordedFrom` says which search or set it came from.

type FixtureName = keyof typeof fixtures;
const match = (name: FixtureName) => matchUniverses(fixtures[name].signals as MatchSignals);
const charactersOf = (name: FixtureName) => match(name).characters.map((c) => c.character);

describe('matchUniverses on recorded books', () => {
  it('The Hobbit: Middle-earth with its characters, not Frodo from merged subjects', () => {
    expect(match('the-hobbit').universes).toEqual(['middle-earth']);
    expect(charactersOf('the-hobbit')).toEqual(
      expect.arrayContaining(['bilbo-baggins', 'gandalf', 'smaug', 'gollum', 'thorin-oakenshield']),
    );
    expect(charactersOf('the-hobbit')).not.toContain('frodo-baggins');
  });

  it("Harry Potter and the Philosopher's Stone: Wizarding World", () => {
    expect(match('harry-potter-philosophers-stone').universes).toEqual(['wizarding-world']);
    expect(charactersOf('harry-potter-philosophers-stone')).toEqual(
      expect.arrayContaining([
        'harry-potter',
        'hermione-granger',
        'ron-weasley',
        'albus-dumbledore',
      ]),
    );
  });

  it('Heir to the Empire: Star Wars, with characters from subjects and the author left out', () => {
    // Open Library lists "timothy zahn" (the author) and "admiral thrawn" as people.
    expect(match('heir-to-the-empire')).toEqual({
      universes: ['star-wars'],
      characters: [
        { universe: 'star-wars', character: 'luke-skywalker' },
        { universe: 'star-wars', character: 'leia-organa' },
        { universe: 'star-wars', character: 'han-solo' },
        { universe: 'star-wars', character: 'thrawn' },
      ],
    });
  });

  it('The Dark Knight Returns: DC, with Batman and Superman', () => {
    expect(match('dark-knight-returns')).toEqual({
      universes: ['dc'],
      characters: [
        { universe: 'dc', character: 'batman' },
        { universe: 'dc', character: 'superman' },
      ],
    });
  });

  it('The Amazing Spider-Man: Marvel, from the title and subjects (no people listed)', () => {
    expect(match('amazing-spider-man')).toEqual({
      universes: ['marvel'],
      characters: [{ universe: 'marvel', character: 'spider-man' }],
    });
  });

  it('matches nothing for a universe that is not in the seed (One Piece)', () => {
    expect(match('one-piece-1')).toEqual({ universes: [], characters: [] });
  });
});

describe('matchUniverses false positives', () => {
  it('a book about the "Star Wars" missile defense program is not Star Wars', () => {
    expect(fixtures['star-wars-missile-defense'].signals.title).toBe('Star wars');
    expect(match('star-wars-missile-defense').universes).toEqual([]);
  });

  it('a book about bats is not Batman', () => {
    expect(match('bats').universes).toEqual([]);
  });

  it("Norse mythology's Thor and Loki are not Marvel's", () => {
    expect(fixtures['norse-mythology'].signals.people).toEqual(['Thor', 'Loki', 'Odin', 'Freya']);
    expect(match('norse-mythology').universes).toEqual([]);
  });
});

describe('matchUniverses on recorded LEGO sets', () => {
  it('Rivendell (an Icons set, not in the LOTR theme): Middle-earth from title and minifigs', () => {
    expect(fixtures.rivendell.signals.legoThemeIds).toEqual([721]);
    expect(match('rivendell').universes).toEqual(['middle-earth']);
    expect(charactersOf('rivendell')).toEqual(
      expect.arrayContaining(['gandalf', 'frodo-baggins', 'peregrin-took', 'meriadoc-brandybuck']),
    );
  });

  it('Millennium Falcon: Star Wars from its theme; Rey and Finn count inside it', () => {
    expect(match('millennium-falcon').universes).toEqual(['star-wars']);
    expect(charactersOf('millennium-falcon')).toEqual(
      expect.arrayContaining([
        'han-solo',
        'chewbacca',
        'leia-organa',
        'c-3po',
        'bb-8',
        'rey',
        'finn',
      ]),
    );
  });

  it('Batmobile Tumbler: DC from a parent theme, with Batman and the Joker', () => {
    expect(match('batmobile-tumbler')).toEqual({
      universes: ['dc'],
      characters: [
        { universe: 'dc', character: 'batman' },
        { universe: 'dc', character: 'joker' },
      ],
    });
  });

  it('Daily Bugle: Marvel, with ambiguous names (Blade, Venom) counted inside it', () => {
    expect(match('daily-bugle').universes).toEqual(['marvel']);
    expect(charactersOf('daily-bugle')).toEqual(
      expect.arrayContaining(['spider-man', 'doctor-octopus', 'blade', 'venom', 'punisher']),
    );
  });

  it('Hogwarts Castle: Wizarding World with the four founders', () => {
    expect(charactersOf('hogwarts-castle')).toEqual([
      'godric-gryffindor',
      'helga-hufflepuff',
      'rowena-ravenclaw',
      'salazar-slytherin',
    ]);
  });
});

describe('matchUniverses rules', () => {
  it('never treats an author as a character', () => {
    expect(
      matchUniverses({ title: 'My Life', authors: ['Gandalf'], people: ['Gandalf'] }).universes,
    ).toEqual([]);
  });

  it('uses series names like titles', () => {
    expect(
      matchUniverses({ title: 'Volume 4', series: ['The Lord of the Rings'] }).universes,
    ).toEqual(['middle-earth']);
  });

  it('matches fictional places', () => {
    expect(matchUniverses({ title: 'A Walking Guide', places: ['Rivendell'] }).universes).toEqual([
      'middle-earth',
    ]);
    expect(
      matchUniverses({ title: 'Guidebook', subjects: ['Hogwarts (Imaginary place)'] }).universes,
    ).toEqual(['wizarding-world']);
  });

  it("doesn't let a single-word alias establish a universe", () => {
    // "Alfred" is Batman's butler, but also a lot of other people.
    expect(matchUniverses({ title: 'A Life', people: ['Alfred'] }).universes).toEqual([]);
    expect(matchUniverses({ title: 'Batman', people: ['Alfred'] }).characters).toContainEqual({
      universe: 'dc',
      character: 'alfred-pennyworth',
    });
  });

  it('only counts an ambiguous character where the universe is already established', () => {
    expect(matchUniverses({ title: 'Legends', people: ['Thor'] }).universes).toEqual([]);
    expect(matchUniverses({ title: 'Avengers Assemble', people: ['Thor'] })).toEqual({
      universes: ['marvel'],
      characters: [{ universe: 'marvel', character: 'thor' }],
    });
  });

  it("treats a name used in two universes as ambiguous (DC's and Marvel's Captain Marvel)", () => {
    expect(matchUniverses({ title: 'Comics', people: ['Captain Marvel'] }).universes).toEqual([]);
    expect(
      matchUniverses({ title: 'Minifig', legoThemeIds: [715], minifigs: ['Captain Marvel'] }),
    ).toEqual({
      universes: ['marvel'],
      characters: [{ universe: 'marvel', character: 'captain-marvel' }],
    });
  });

  it('allows crossovers between universes', () => {
    expect(matchUniverses({ title: 'Spider-Man and Batman' })).toEqual({
      universes: ['dc', 'marvel'],
      characters: [
        { universe: 'dc', character: 'batman' },
        { universe: 'marvel', character: 'spider-man' },
      ],
    });
  });

  it('accepts a different seed', () => {
    const seed: UniverseSeed[] = [
      {
        slug: 'one-piece',
        name: 'One Piece',
        wikidataId: 'Q673',
        description: '',
        titleAliases: ['One Piece'],
        places: [],
        legoThemeIds: [],
        characters: [
          { slug: 'luffy', name: 'Monkey D. Luffy', wikidataId: 'Q1', aliases: ['Luffy'] },
        ],
      },
    ];
    expect(matchUniverses(fixtures['one-piece-1'].signals as MatchSignals, seed)).toEqual({
      universes: ['one-piece'],
      characters: [{ universe: 'one-piece', character: 'luffy' }],
    });
  });
});
