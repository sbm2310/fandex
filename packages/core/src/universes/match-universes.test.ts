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
});

describe('matchUniverses on recorded items: One Piece and Pokémon', () => {
  it('One Piece vol. 1, in Japanese and from VIZ: One Piece with Luffy', () => {
    for (const name of ['one-piece-1', 'one-piece-vol-1-viz'] as const)
      expect([name, match(name)]).toEqual([
        name,
        {
          universes: ['one-piece'],
          characters: [{ universe: 'one-piece', character: 'monkey-d-luffy' }],
        },
      ]);
  });

  it('One Piece LEGO sets: the theme, and the crew from minifig names', () => {
    expect(fixtures['going-merry'].signals.legoThemeIds).toEqual([775]);
    expect(charactersOf('going-merry')).toEqual([
      'monkey-d-luffy',
      'roronoa-zoro',
      'nami',
      'sanji',
      'usopp',
    ]);
    expect(charactersOf('battle-at-arlong-park')).toEqual([
      'monkey-d-luffy',
      'nami',
      'usopp',
      'arlong',
    ]);
  });

  it('Pokémon books with or without the accent, and Pikachu from a title', () => {
    expect(fixtures['pokemon-adventures-1'].signals.title).toMatch(/^Pokemon Adventures/);
    expect(match('pokemon-adventures-1')).toEqual({
      universes: ['pokemon'],
      characters: [{ universe: 'pokemon', character: 'pikachu' }],
    });
    for (const name of ['pokemon-essential-handbook', 'pokemon-ultra-sun-guide'] as const)
      expect([name, match(name).universes]).toEqual([name, ['pokemon']]);
  });

  it('Pokémon LEGO sets (no minifigs): the theme, and the Pokémon named in the title', () => {
    expect(fixtures['charizard-vs-jolteon'].signals.minifigs).toEqual([]);
    expect(match('charizard-vs-jolteon')).toEqual({
      universes: ['pokemon'],
      characters: [{ universe: 'pokemon', character: 'charizard' }],
    });
    expect(charactersOf('training-house-with-pikachu')).toEqual(['pikachu']);
  });

  it('"in one piece", one-piece sewing and Misty the pony match nothing', () => {
    expect(match('all-in-one-piece').universes).toEqual([]);
    expect(fixtures['one-piece-wearables'].signals.subjects).toContain('Sewing');
    expect(match('one-piece-wearables').universes).toEqual([]);
    expect(match('misty-of-chincoteague').universes).toEqual([]);
    for (const title of ['One Piece at a Time', 'The Classic One-Piece Swimsuit'])
      expect([title, matchUniverses({ title }).universes]).toEqual([title, []]);
  });

  it('Kanto, Misty, Brock and Ash alone are not Pokémon', () => {
    expect(matchUniverses({ title: 'Walking Tokyo', places: ['Kanto'] }).universes).toEqual([]);
    expect(
      matchUniverses({ title: 'Ponies', people: ['Misty', 'Brock', 'Ash'] }).universes,
    ).toEqual([]);
  });
});

describe('matchUniverses on recorded books: A Song of Ice and Fire and Cosmere', () => {
  it('A Game of Thrones: its main characters, from the people Open Library lists', () => {
    expect(match('a-game-of-thrones').universes).toEqual(['a-song-of-ice-and-fire']);
    expect(charactersOf('a-game-of-thrones')).toEqual(
      expect.arrayContaining([
        'jon-snow',
        'daenerys-targaryen',
        'tyrion-lannister',
        'eddard-stark',
        'arya-stark',
      ]),
    );
  });

  it('books without characters still match on subjects, places and titles', () => {
    // Graphic novel: "Seven kingdoms (imaginary place), fiction". Fire & Blood: "Westeros".
    // The science book: "Game of thrones (Television program)".
    for (const name of [
      'game-of-thrones-graphic-novel-2',
      'fire-and-blood',
      'knight-of-the-seven-kingdoms',
      'science-of-game-of-thrones',
    ] as const)
      expect([name, match(name).universes]).toEqual([name, ['a-song-of-ice-and-fire']]);
  });

  it('The Way of Kings and Mistborn: Cosmere, from a series subject or the title', () => {
    expect(fixtures['the-way-of-kings'].signals.subjects).toContain('series:Stormlight Archive');
    for (const name of ['the-way-of-kings', 'mistborn-final-empire', 'hero-of-ages'] as const)
      expect([name, match(name).universes]).toEqual([name, ['cosmere']]);
  });

  it('a Song of Songs commentary and a book on fire and ice match nothing', () => {
    expect(match('song-of-songs').universes).toEqual([]);
    expect(match('fire-and-ice-temperatures').universes).toEqual([]);
  });

  it('titles other authors share stay unlinked', () => {
    for (const title of [
      'Fire and Blood: A History of Mexico',
      'The Winds of Winter',
      'Clash of Kings Game Guide',
      'Way of Kings',
      'The Final Empire',
    ])
      expect([title, matchUniverses({ title }).universes]).toEqual([title, []]);
  });

  it('Jon Snow the newsreader, Vin and Hoid only count inside their universe', () => {
    expect(matchUniverses({ title: 'Shooting History', people: ['Jon Snow'] }).universes).toEqual(
      [],
    );
    expect(matchUniverses({ title: 'Wine', people: ['Vin'] }).universes).toEqual([]);
    expect(matchUniverses({ title: 'Mistborn', people: ['Vin', 'Hoid'] })).toEqual({
      universes: ['cosmere'],
      characters: [
        { universe: 'cosmere', character: 'vin' },
        { universe: 'cosmere', character: 'hoid' },
      ],
    });
  });
});

describe('matchUniverses on recorded items: Jurassic Park and Disney & Pixar', () => {
  it("Crichton's novels: Jurassic Park, with its people", () => {
    expect(match('jurassic-park-novel').universes).toEqual(['jurassic-park']);
    expect(charactersOf('jurassic-park-novel')).toEqual(
      expect.arrayContaining(['ian-malcolm', 'alan-grant', 'john-hammond', 'ellie-sattler']),
    );
    // The Lost World's title says nothing; its places and subjects do.
    expect(fixtures['the-lost-world-crichton'].signals.title).toBe('The Lost World');
    expect(match('the-lost-world-crichton')).toEqual({
      universes: ['jurassic-park'],
      characters: [{ universe: 'jurassic-park', character: 'ian-malcolm' }],
    });
    expect(match('jurassic-world-junior').universes).toEqual(['jurassic-park']);
  });

  it("Conan Doyle's The Lost World and a dinosaur encyclopedia are not Jurassic Park", () => {
    expect(match('the-lost-world-doyle').universes).toEqual([]);
    expect(match('dinosaur-encyclopedia').universes).toEqual([]);
  });

  it('Jurassic World LEGO: the theme, and Nedry from a minifig', () => {
    expect(match('jurassic-park-jeep-wrangler')).toEqual({
      universes: ['jurassic-park'],
      characters: [{ universe: 'jurassic-park', character: 'dennis-nedry' }],
    });
    expect(match('raptor-titanosaurus-tracking').universes).toEqual(['jurassic-park']);
  });

  it('Disney books: a film title or the "Disney Frozen" subject', () => {
    for (const name of [
      'toy-story-golden-book',
      'frozen-junior-novel',
      'lion-king-golden-book',
    ] as const)
      expect([name, match(name).universes]).toEqual([name, ['disney-pixar']]);
  });

  it('Disney LEGO: characters, ambiguous names included, once the theme says Disney', () => {
    expect(charactersOf('elsas-ice-palace')).toEqual(['elsa', 'anna', 'olaf']);
    expect(charactersOf('buzz-and-woodys-carnival-mania')).toEqual(['woody', 'buzz-lightyear']);
    expect(charactersOf('disney-castle')).toEqual(['rapunzel']);
    // Cars is its own top-level theme; Lightning McQueen is named in the title.
    expect(match('ultimate-build-lightning-mcqueen')).toEqual({
      universes: ['disney-pixar'],
      characters: [{ universe: 'disney-pixar', character: 'lightning-mcqueen' }],
    });
    expect(match('stitch').universes).toEqual(['disney-pixar']);
  });

  it('Pirates of the Caribbean, under the Disney theme, is not Disney & Pixar', () => {
    expect(fixtures['black-pearl'].signals.legoThemeIds).toEqual([263, 608]);
    expect(match('black-pearl')).toEqual({ universes: [], characters: [] });
  });

  it('Disney as a publisher or a word is never enough', () => {
    // Published by Disney Lucasfilm Press and from Marvel Animation.
    expect(match('star-wars-ahsoka').universes).toEqual(['star-wars']);
    expect(match('ultimate-spider-man-iron-spider').universes).toEqual(['marvel']);
    for (const title of [
      'Disney: The Biography',
      'The Walt Disney Company: A Corporate History',
      'Frozen Planet',
      'Tangled Hearts',
      'Cars of the 1950s',
    ])
      expect([title, matchUniverses({ title }).universes]).toEqual([title, []]);
  });

  it('fairy tales, legends and people with Disney names stay unlinked', () => {
    const people = ['Ariel', 'Belle', 'Rapunzel', 'Mulan', 'Simba', 'Woody', 'John Hammond'];
    expect(matchUniverses({ title: 'Stories', people }).universes).toEqual([]);
    expect(matchUniverses({ title: 'Blues Legends', people: ['John Hammond'] }).universes).toEqual(
      [],
    );
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

describe('matchUniverses with curated links', () => {
  it('uses them as they are, in seed order, dropping what the seed does not know', () => {
    const signals: MatchSignals = {
      title: 'Supergirl (Supergirl, 2026)',
      curated: {
        universes: ['marvel', 'dc', 'narnia'],
        characters: [
          { universe: 'dc', character: 'superman' },
          { universe: 'dc', character: 'nobody' },
          { universe: 'middle-earth', character: 'gandalf' },
        ],
      },
    };
    expect(matchUniverses(signals)).toEqual({
      universes: ['dc', 'marvel'],
      characters: [{ universe: 'dc', character: 'superman' }],
    });
  });

  it('ignores what the title would have matched', () => {
    const signals: MatchSignals = {
      title: 'Gandalf the Grey',
      curated: { universes: [], characters: [] },
    };
    expect(matchUniverses(signals)).toEqual({ universes: [], characters: [] });
  });
});
