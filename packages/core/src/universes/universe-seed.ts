/**
 * The curated universe seed: which universes Fandex knows, how to recognize them, and their
 * main characters. Drafted from Wikidata (CC0; characters ranked by how many Wikipedias cover
 * them) and reviewed by hand. Growing Fandex to a new universe is a data change here.
 */

export type CharacterSeed = {
  /** Stable id within the universe, used in URLs: "gandalf". */
  slug: string;
  name: string;
  /** Wikidata item, e.g. "Q177499" for Gandalf. */
  wikidataId: string;
  /**
   * Other names this character is listed under in Open Library or Rebrickable
   * ("Gandalf the Grey", "Mithrandir"). Compared as whole names, never as parts of a title.
   */
  aliases?: string[];
  /**
   * Names distinctive enough to recognize the character, and its universe, in a title
   * ("Batman: Year One"). Generic names ("Robin", "Thor", "Iron Man") are left out.
   */
  titleNames?: string[];
  /**
   * The name also means something else (Thor the Norse god, Robin Hood, Ted Hughes' Iron Man),
   * so it only counts inside a universe other signals have already established.
   */
  ambiguous?: true;
};

export type UniverseSeed = {
  /** Stable id used in URLs and the database: "middle-earth". */
  slug: string;
  name: string;
  wikidataId: string;
  description: string;
  /** Phrases that identify the universe in a title, series or subject ("lord of the rings"). */
  titleAliases: string[];
  /** Fictional places (Open Library lists them per work): "Rivendell", "Hogwarts". */
  places: string[];
  /** Rebrickable theme ids; a set matches if its theme or any parent theme is listed. */
  legoThemeIds: number[];
  /** Phrases that rule the universe out ("strategic defense initiative" isn't Star Wars). */
  excludePhrases?: string[];
  characters: CharacterSeed[];
};

export const UNIVERSE_SEED: readonly UniverseSeed[] = [
  {
    slug: 'middle-earth',
    name: 'Middle-earth',
    wikidataId: 'Q81738',
    description:
      "J. R. R. Tolkien's world of The Hobbit, The Lord of the Rings and The Silmarillion.",
    titleAliases: [
      'Middle-earth',
      'Hobbit',
      'Lord of the Rings',
      'Silmarillion',
      'Fellowship of the Ring',
      'The Two Towers',
      'Return of the King',
      'Unfinished Tales',
      'Children of Húrin',
      'Rings of Power',
    ],
    places: [
      'Middle-earth',
      'the Shire',
      'Rivendell',
      'Mordor',
      'Gondor',
      'Rohan',
      'Mirkwood',
      'Lonely Mountain',
      'Erebor',
      'Misty Mountains',
      'Moria',
      'Isengard',
      'Lothlórien',
      'Minas Tirith',
      'Lake-town',
      'Númenor',
      'Beleriand',
    ],
    legoThemeIds: [561], // The Hobbit and Lord of the Rings
    characters: [
      {
        slug: 'gandalf',
        name: 'Gandalf',
        wikidataId: 'Q177499',
        aliases: ['Gandalf the Grey', 'Gandalf the White', 'Mithrandir'],
        titleNames: ['Gandalf'],
      },
      {
        slug: 'bilbo-baggins',
        name: 'Bilbo Baggins',
        wikidataId: 'Q185737',
        aliases: ['Bilbo'],
        titleNames: ['Bilbo Baggins'],
      },
      {
        slug: 'frodo-baggins',
        name: 'Frodo Baggins',
        wikidataId: 'Q177329',
        aliases: ['Frodo'],
        titleNames: ['Frodo Baggins'],
      },
      {
        slug: 'samwise-gamgee',
        name: 'Samwise Gamgee',
        wikidataId: 'Q219473',
        aliases: ['Sam Gamgee', 'Samwise'],
      },
      { slug: 'aragorn', name: 'Aragorn', wikidataId: 'Q180322', aliases: ['Elessar'] },
      { slug: 'legolas', name: 'Legolas', wikidataId: 'Q213480', aliases: ['Legolas Greenleaf'] },
      { slug: 'gimli', name: 'Gimli', wikidataId: 'Q206818' },
      {
        slug: 'peregrin-took',
        name: 'Peregrin Took',
        wikidataId: 'Q219493',
        aliases: ['Pippin', 'Pippin Took'],
      },
      {
        slug: 'meriadoc-brandybuck',
        name: 'Meriadoc Brandybuck',
        wikidataId: 'Q219498',
        aliases: ['Merry', 'Merry Brandybuck'],
      },
      { slug: 'boromir', name: 'Boromir', wikidataId: 'Q219504' },
      { slug: 'faramir', name: 'Faramir', wikidataId: 'Q223468' },
      {
        slug: 'gollum',
        name: 'Gollum',
        wikidataId: 'Q15007',
        aliases: ['Sméagol'],
        titleNames: ['Gollum'],
      },
      { slug: 'sauron', name: 'Sauron', wikidataId: 'Q2281', titleNames: ['Sauron'] },
      { slug: 'saruman', name: 'Saruman', wikidataId: 'Q216489', aliases: ['Saruman the White'] },
      { slug: 'smaug', name: 'Smaug', wikidataId: 'Q46302', titleNames: ['Smaug'] },
      { slug: 'galadriel', name: 'Galadriel', wikidataId: 'Q204274' },
      { slug: 'elrond', name: 'Elrond', wikidataId: 'Q208426' },
      { slug: 'arwen', name: 'Arwen', wikidataId: 'Q206018' },
      {
        slug: 'thorin-oakenshield',
        name: 'Thorin Oakenshield',
        wikidataId: 'Q46285',
        aliases: ['Thorin'],
      },
      { slug: 'thranduil', name: 'Thranduil', wikidataId: 'Q746840', aliases: ['Elvenking'] },
      { slug: 'theoden', name: 'Théoden', wikidataId: 'Q308813' },
      { slug: 'eowyn', name: 'Éowyn', wikidataId: 'Q716565' },
      { slug: 'morgoth', name: 'Morgoth', wikidataId: 'Q80453', titleNames: ['Morgoth'] },
    ],
  },
  {
    slug: 'star-wars',
    name: 'Star Wars',
    wikidataId: 'Q19786052',
    description: 'The galaxy far, far away of the Skywalker saga and its spin-offs.',
    titleAliases: ['Star Wars', 'Jedi', 'The Mandalorian', 'Clone Wars'],
    places: ['Tatooine', 'Coruscant', 'Hoth', 'Naboo', 'Endor', 'Dagobah', 'Death Star'],
    legoThemeIds: [158, 18, 209, 261], // Star Wars, Technic / Advent / Mindstorms Star Wars
    excludePhrases: ['Strategic Defense Initiative', 'Ballistic missile defenses'],
    characters: [
      {
        slug: 'darth-vader',
        name: 'Darth Vader',
        wikidataId: 'Q12206942',
        aliases: ['Vader'],
        titleNames: ['Darth Vader'],
      },
      {
        slug: 'luke-skywalker',
        name: 'Luke Skywalker',
        wikidataId: 'Q51746',
        titleNames: ['Luke Skywalker'],
      },
      {
        slug: 'leia-organa',
        name: 'Leia Organa',
        wikidataId: 'Q51797',
        aliases: ['Princess Leia', 'Leia'],
      },
      { slug: 'han-solo', name: 'Han Solo', wikidataId: 'Q51802', titleNames: ['Han Solo'] },
      { slug: 'chewbacca', name: 'Chewbacca', wikidataId: 'Q51803', aliases: ['Chewie'] },
      {
        slug: 'obi-wan-kenobi',
        name: 'Obi-Wan Kenobi',
        wikidataId: 'Q51740',
        aliases: ['Ben Kenobi'],
        titleNames: ['Obi-Wan Kenobi', 'Kenobi'],
      },
      { slug: 'yoda', name: 'Yoda', wikidataId: 'Q51730', titleNames: ['Yoda'] },
      {
        slug: 'anakin-skywalker',
        name: 'Anakin Skywalker',
        wikidataId: 'Q51752',
        titleNames: ['Anakin Skywalker'],
      },
      {
        slug: 'palpatine',
        name: 'Palpatine',
        wikidataId: 'Q51770',
        aliases: ['Emperor Palpatine', 'Darth Sidious'],
      },
      { slug: 'padme-amidala', name: 'Padmé Amidala', wikidataId: 'Q51789', aliases: ['Padmé'] },
      { slug: 'c-3po', name: 'C-3PO', wikidataId: 'Q51787' },
      { slug: 'r2-d2', name: 'R2-D2', wikidataId: 'Q51788' },
      { slug: 'bb-8', name: 'BB-8', wikidataId: 'Q21541731' },
      { slug: 'darth-maul', name: 'Darth Maul', wikidataId: 'Q51766', titleNames: ['Darth Maul'] },
      { slug: 'boba-fett', name: 'Boba Fett', wikidataId: 'Q51790', titleNames: ['Boba Fett'] },
      {
        slug: 'ahsoka-tano',
        name: 'Ahsoka Tano',
        wikidataId: 'Q51755',
        aliases: ['Ahsoka'],
        titleNames: ['Ahsoka'],
      },
      { slug: 'kylo-ren', name: 'Kylo Ren', wikidataId: 'Q21515016' },
      { slug: 'rey', name: 'Rey', wikidataId: 'Q21772117', ambiguous: true },
      { slug: 'finn', name: 'Finn', wikidataId: 'Q21772120', ambiguous: true },
      { slug: 'grogu', name: 'Grogu', wikidataId: 'Q77001957', aliases: ['The Child'] },
      {
        slug: 'lando-calrissian',
        name: 'Lando Calrissian',
        wikidataId: 'Q51799',
        aliases: ['Lando'],
      },
      { slug: 'jabba-the-hutt', name: 'Jabba the Hutt', wikidataId: 'Q51794', aliases: ['Jabba'] },
      {
        slug: 'thrawn',
        name: 'Thrawn',
        wikidataId: 'Q51780',
        aliases: ['Admiral Thrawn', 'Grand Admiral Thrawn'],
        titleNames: ['Thrawn'],
      },
    ],
  },
  {
    slug: 'wizarding-world',
    name: 'Wizarding World',
    wikidataId: 'Q5410773',
    description: 'The world of Harry Potter, Hogwarts and Fantastic Beasts.',
    titleAliases: ['Harry Potter', 'Hogwarts', 'Fantastic Beasts', 'Wizarding World', 'Quidditch'],
    places: [
      'Hogwarts',
      'Hogwarts School of Witchcraft and Wizardry',
      'Diagon Alley',
      'Hogsmeade',
      'Azkaban',
      'Gringotts Wizarding Bank',
      'Platform Nine and Three-quarters',
    ],
    legoThemeIds: [246, 656, 691, 710], // Harry Potter, Minifigures series 1–2, Advent
    characters: [
      {
        slug: 'harry-potter',
        name: 'Harry Potter',
        wikidataId: 'Q3244512',
        titleNames: ['Harry Potter'],
      },
      {
        slug: 'hermione-granger',
        name: 'Hermione Granger',
        wikidataId: 'Q174009',
        aliases: ['Hermione'],
      },
      { slug: 'ron-weasley', name: 'Ron Weasley', wikidataId: 'Q173998' },
      {
        slug: 'albus-dumbledore',
        name: 'Albus Dumbledore',
        wikidataId: 'Q712548',
        aliases: ['Dumbledore', 'Professor Dumbledore'],
        titleNames: ['Dumbledore'],
      },
      {
        slug: 'lord-voldemort',
        name: 'Lord Voldemort',
        wikidataId: 'Q176132',
        aliases: ['Voldemort', 'Tom Riddle'],
        titleNames: ['Voldemort'],
      },
      {
        slug: 'severus-snape',
        name: 'Severus Snape',
        wikidataId: 'Q176772',
        aliases: ['Professor Snape'],
      },
      { slug: 'rubeus-hagrid', name: 'Rubeus Hagrid', wikidataId: 'Q177439', aliases: ['Hagrid'] },
      { slug: 'draco-malfoy', name: 'Draco Malfoy', wikidataId: 'Q179641' },
      {
        slug: 'minerva-mcgonagall',
        name: 'Minerva McGonagall',
        wikidataId: 'Q192179',
        aliases: ['Professor McGonagall'],
      },
      { slug: 'sirius-black', name: 'Sirius Black', wikidataId: 'Q713701' },
      { slug: 'ginny-weasley', name: 'Ginny Weasley', wikidataId: 'Q187923' },
      {
        slug: 'remus-lupin',
        name: 'Remus Lupin',
        wikidataId: 'Q208657',
        aliases: ['Professor Lupin'],
      },
      { slug: 'luna-lovegood', name: 'Luna Lovegood', wikidataId: 'Q190282' },
      { slug: 'neville-longbottom', name: 'Neville Longbottom', wikidataId: 'Q190366' },
      { slug: 'bellatrix-lestrange', name: 'Bellatrix Lestrange', wikidataId: 'Q1057918' },
      { slug: 'dolores-umbridge', name: 'Dolores Umbridge', wikidataId: 'Q716941' },
      { slug: 'godric-gryffindor', name: 'Godric Gryffindor', wikidataId: 'Q3349480' },
      { slug: 'helga-hufflepuff', name: 'Helga Hufflepuff', wikidataId: 'Q3080574' },
      { slug: 'rowena-ravenclaw', name: 'Rowena Ravenclaw', wikidataId: 'Q2674728' },
      { slug: 'salazar-slytherin', name: 'Salazar Slytherin', wikidataId: 'Q928596' },
    ],
  },
  {
    slug: 'dc',
    name: 'DC',
    wikidataId: 'Q1152150',
    description: 'The DC Universe of Batman, Superman, Wonder Woman and the Justice League.',
    titleAliases: ['Justice League', 'Gotham', 'Teen Titans', 'Suicide Squad', 'DC Universe'],
    places: ['Gotham City', 'Metropolis', 'Arkham Asylum', 'Themyscira', 'Krypton'],
    // Super Heroes DC, Juniors / Duplo DC, DC Super Hero Girls, LEGO Batman Movie and DC minifigures
    legoThemeIds: [695, 592, 617, 653, 609, 684, 711],
    characters: [
      {
        slug: 'batman',
        name: 'Batman',
        wikidataId: 'Q2695156',
        aliases: ['Bruce Wayne'],
        titleNames: ['Batman'],
      },
      {
        slug: 'superman',
        name: 'Superman',
        wikidataId: 'Q79015',
        aliases: ['Clark Kent'],
        titleNames: ['Superman'],
      },
      {
        slug: 'wonder-woman',
        name: 'Wonder Woman',
        wikidataId: 'Q338430',
        aliases: ['Diana Prince'],
        titleNames: ['Wonder Woman'],
      },
      { slug: 'joker', name: 'The Joker', wikidataId: 'Q217533', aliases: ['Joker'] },
      {
        slug: 'harley-quinn',
        name: 'Harley Quinn',
        wikidataId: 'Q849477',
        titleNames: ['Harley Quinn'],
      },
      {
        slug: 'catwoman',
        name: 'Catwoman',
        wikidataId: 'Q158952',
        aliases: ['Selina Kyle'],
        titleNames: ['Catwoman'],
      },
      {
        slug: 'flash',
        name: 'The Flash',
        wikidataId: 'Q180784',
        aliases: ['Flash', 'Barry Allen'],
        ambiguous: true,
      },
      { slug: 'aquaman', name: 'Aquaman', wikidataId: 'Q623059', titleNames: ['Aquaman'] },
      {
        slug: 'green-arrow',
        name: 'Green Arrow',
        wikidataId: 'Q611993',
        titleNames: ['Green Arrow'],
      },
      { slug: 'robin', name: 'Robin', wikidataId: 'Q59996', ambiguous: true },
      { slug: 'batgirl', name: 'Batgirl', wikidataId: 'Q753713', titleNames: ['Batgirl'] },
      { slug: 'lex-luthor', name: 'Lex Luthor', wikidataId: 'Q694790' },
      { slug: 'two-face', name: 'Two-Face', wikidataId: 'Q295599' },
      { slug: 'riddler', name: 'The Riddler', wikidataId: 'Q836789', aliases: ['Riddler'] },
      {
        slug: 'penguin',
        name: 'The Penguin',
        wikidataId: 'Q384193',
        aliases: ['Penguin'],
        ambiguous: true,
      },
      { slug: 'poison-ivy', name: 'Poison Ivy', wikidataId: 'Q375671', ambiguous: true },
      { slug: 'bane', name: 'Bane', wikidataId: 'Q158940', ambiguous: true },
      {
        slug: 'alfred-pennyworth',
        name: 'Alfred Pennyworth',
        wikidataId: 'Q159051',
        aliases: ['Alfred'],
      },
      {
        slug: 'jim-gordon',
        name: 'Jim Gordon',
        wikidataId: 'Q116113',
        aliases: ['Commissioner Gordon'],
      },
      { slug: 'shazam', name: 'Shazam', wikidataId: 'Q534153', aliases: ['Captain Marvel'] },
    ],
  },
  {
    slug: 'marvel',
    name: 'Marvel',
    wikidataId: 'Q931597',
    description: 'The Marvel Universe of Spider-Man, the Avengers and the X-Men.',
    titleAliases: [
      'Marvel Universe',
      'Avengers',
      'X-Men',
      'Fantastic Four',
      'Guardians of the Galaxy',
      'S.H.I.E.L.D.',
    ],
    places: ['Wakanda', 'Latveria', 'Sanctum Sanctorum'],
    // Super Heroes Marvel, Juniors / 4 Juniors / Duplo Marvel, Marvel minifigures, Advent, Spider-Verse
    legoThemeIds: [696, 287, 596, 630, 715, 750, 751, 784],
    characters: [
      {
        slug: 'spider-man',
        name: 'Spider-Man',
        wikidataId: 'Q79037',
        aliases: ['Peter Parker', 'Spiderman'],
        titleNames: ['Spider-Man', 'Spiderman'],
      },
      {
        slug: 'iron-man',
        name: 'Iron Man',
        wikidataId: 'Q180704',
        aliases: ['Tony Stark'],
        ambiguous: true,
      },
      {
        slug: 'captain-america',
        name: 'Captain America',
        wikidataId: 'Q190679',
        aliases: ['Steve Rogers'],
        titleNames: ['Captain America'],
      },
      {
        slug: 'hulk',
        name: 'Hulk',
        wikidataId: 'Q188760',
        aliases: ['Bruce Banner'],
        titleNames: ['Incredible Hulk'],
      },
      { slug: 'thor', name: 'Thor', wikidataId: 'Q717588', ambiguous: true },
      { slug: 'loki', name: 'Loki', wikidataId: 'Q1147326', ambiguous: true },
      {
        slug: 'wolverine',
        name: 'Wolverine',
        wikidataId: 'Q186422',
        aliases: ['Logan'],
        titleNames: ['Wolverine'],
      },
      { slug: 'deadpool', name: 'Deadpool', wikidataId: 'Q1631090', titleNames: ['Deadpool'] },
      {
        slug: 'black-widow',
        name: 'Black Widow',
        wikidataId: 'Q369197',
        aliases: ['Natasha Romanoff'],
        ambiguous: true,
      },
      { slug: 'hawkeye', name: 'Hawkeye', wikidataId: 'Q19095', ambiguous: true },
      {
        slug: 'black-panther',
        name: 'Black Panther',
        wikidataId: 'Q998220',
        aliases: ["T'Challa"],
        ambiguous: true,
      },
      {
        slug: 'doctor-strange',
        name: 'Doctor Strange',
        wikidataId: 'Q907767',
        titleNames: ['Doctor Strange'],
      },
      { slug: 'daredevil', name: 'Daredevil', wikidataId: 'Q327553', ambiguous: true },
      { slug: 'thanos', name: 'Thanos', wikidataId: 'Q2276627', titleNames: ['Thanos'] },
      { slug: 'venom', name: 'Venom', wikidataId: 'Q1621261', ambiguous: true },
      { slug: 'green-goblin', name: 'Green Goblin', wikidataId: 'Q735721' },
      {
        slug: 'doctor-octopus',
        name: 'Doctor Octopus',
        wikidataId: 'Q578094',
        aliases: ['Dr. Octopus', 'Doc Ock'],
      },
      {
        slug: 'punisher',
        name: 'The Punisher',
        wikidataId: 'Q729150',
        aliases: ['Punisher'],
        ambiguous: true,
      },
      { slug: 'magneto', name: 'Magneto', wikidataId: 'Q840291' },
      {
        slug: 'professor-x',
        name: 'Professor X',
        wikidataId: 'Q838076',
        aliases: ['Charles Xavier'],
      },
      { slug: 'storm', name: 'Storm', wikidataId: 'Q632212', ambiguous: true },
      {
        slug: 'scarlet-witch',
        name: 'Scarlet Witch',
        wikidataId: 'Q929285',
        aliases: ['Wanda Maximoff'],
      },
      { slug: 'blade', name: 'Blade', wikidataId: 'Q881024', ambiguous: true },
      {
        slug: 'captain-marvel',
        name: 'Captain Marvel',
        wikidataId: 'Q726756',
        aliases: ['Carol Danvers'],
      },
    ],
  },
];

/** A universe from the seed by slug. */
export function findUniverse(
  slug: string,
  seed: readonly UniverseSeed[] = UNIVERSE_SEED,
): UniverseSeed | undefined {
  return seed.find((universe) => universe.slug === slug);
}

/** A character from the seed by universe and character slug. */
export function findCharacter(
  universeSlug: string,
  characterSlug: string,
  seed: readonly UniverseSeed[] = UNIVERSE_SEED,
): CharacterSeed | undefined {
  return findUniverse(universeSlug, seed)?.characters.find(
    (character) => character.slug === characterSlug,
  );
}
