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
  /**
   * Themes under a listed one that don't belong to the universe: Disney's theme also holds
   * Pirates of the Caribbean. A set in (or under) one of these doesn't match by theme.
   */
  excludeLegoThemeIds?: number[];
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
  {
    slug: 'a-song-of-ice-and-fire',
    name: 'A Song of Ice and Fire',
    wikidataId: 'Q2461698',
    description:
      "George R. R. Martin's Westeros: A Song of Ice and Fire, Game of Thrones and House of the Dragon.",
    // Only phrases nearly every Open Library title containing them is about (checked 2026-10-29):
    // not "Fire and Blood" (also a history of Mexico; its editions list Westeros), "Winds of
    // Winter" (romances), or "Clash of Kings" without the article (a mobile game's guides).
    titleAliases: [
      'Song of Ice and Fire',
      'World of Ice and Fire',
      'World of Ice & Fire',
      'Game of Thrones',
      'A Clash of Kings',
      'A Storm of Swords',
      'A Feast for Crows',
      'A Dance with Dragons',
      'House of the Dragon',
      'Knight of the Seven Kingdoms',
      'The Hedge Knight',
      'Westeros',
    ],
    places: [
      'Westeros',
      'Essos',
      'Seven Kingdoms',
      'Winterfell',
      "King's Landing",
      'Castle Black',
      'Casterly Rock',
      'Dragonstone',
      'Riverrun',
      'Harrenhal',
      'Highgarden',
      "Storm's End",
      'Braavos',
      'Meereen',
      'Valyria',
      'Red Keep',
      'Vaes Dothrak',
    ],
    legoThemeIds: [],
    characters: [
      // Jon Snow is also a British newsreader with books of his own.
      { slug: 'jon-snow', name: 'Jon Snow', wikidataId: 'Q3183235', ambiguous: true },
      {
        slug: 'daenerys-targaryen',
        name: 'Daenerys Targaryen',
        wikidataId: 'Q2708078',
        aliases: ['Daenerys', 'Dany', 'Daenerys Stormborn', 'Mother of Dragons'],
      },
      {
        slug: 'tyrion-lannister',
        name: 'Tyrion Lannister',
        wikidataId: 'Q2076759',
        aliases: ['Tyrion'],
      },
      {
        slug: 'eddard-stark',
        name: 'Eddard Stark',
        wikidataId: 'Q259818',
        aliases: ['Ned Stark'],
      },
      { slug: 'cersei-lannister', name: 'Cersei Lannister', wikidataId: 'Q3665163' },
      {
        slug: 'jaime-lannister',
        name: 'Jaime Lannister',
        wikidataId: 'Q3806180',
        aliases: ['Kingslayer'],
      },
      { slug: 'sansa-stark', name: 'Sansa Stark', wikidataId: 'Q3472490' },
      { slug: 'arya-stark', name: 'Arya Stark', wikidataId: 'Q3624677', aliases: ['Arya'] },
      {
        slug: 'catelyn-stark',
        name: 'Catelyn Stark',
        wikidataId: 'Q2941743',
        aliases: ['Catelyn Tully', 'Lady Stoneheart'],
      },
      { slug: 'joffrey-baratheon', name: 'Joffrey Baratheon', wikidataId: 'Q12900597' },
      {
        slug: 'bran-stark',
        name: 'Bran Stark',
        wikidataId: 'Q3643599',
        aliases: ['Brandon Stark'],
      },
      {
        slug: 'petyr-baelish',
        name: 'Petyr Baelish',
        wikidataId: 'Q4360302',
        aliases: ['Littlefinger'],
      },
      { slug: 'robb-stark', name: 'Robb Stark', wikidataId: 'Q13634884' },
      { slug: 'theon-greyjoy', name: 'Theon Greyjoy', wikidataId: 'Q1120793', aliases: ['Reek'] },
      { slug: 'tywin-lannister', name: 'Tywin Lannister', wikidataId: 'Q12902445' },
      { slug: 'robert-baratheon', name: 'Robert Baratheon', wikidataId: 'Q13634885' },
      {
        slug: 'sandor-clegane',
        name: 'Sandor Clegane',
        wikidataId: 'Q3948140',
        aliases: ['The Hound'],
      },
      { slug: 'stannis-baratheon', name: 'Stannis Baratheon', wikidataId: 'Q12056060' },
      { slug: 'melisandre', name: 'Melisandre', wikidataId: 'Q6009607' },
      {
        slug: 'davos-seaworth',
        name: 'Davos Seaworth',
        wikidataId: 'Q5800500',
        aliases: ['The Onion Knight'],
      },
      { slug: 'varys', name: 'Varys', wikidataId: 'Q4008842' },
      { slug: 'brienne-of-tarth', name: 'Brienne of Tarth', wikidataId: 'Q11680307' },
      {
        slug: 'samwell-tarly',
        name: 'Samwell Tarly',
        wikidataId: 'Q11703515',
        aliases: ['Sam Tarly'],
      },
      { slug: 'rhaenyra-targaryen', name: 'Rhaenyra Targaryen', wikidataId: 'Q55452801' },
      { slug: 'daemon-targaryen', name: 'Daemon Targaryen', wikidataId: 'Q55520758' },
    ],
  },
  {
    slug: 'cosmere',
    name: 'Cosmere',
    wikidataId: 'Q18535364',
    description:
      "Brandon Sanderson's shared universe of The Stormlight Archive, Mistborn, Elantris and Warbreaker.",
    // Not "The Way of Kings", "The Final Empire", "Shadows of Self" or "Dawnshard": other
    // authors' books share those titles. Their editions say Stormlight or Mistborn, mostly.
    titleAliases: [
      'Cosmere',
      'Stormlight Archive',
      'Words of Radiance',
      'Oathbringer',
      'Rhythm of War',
      'Wind and Truth',
      'Edgedancer',
      'Mistborn',
      'Well of Ascension',
      'Hero of Ages',
      'Alloy of Law',
      'Bands of Mourning',
      'The Lost Metal',
      'Elantris',
      'Warbreaker',
      "The Emperor's Soul",
      'Arcanum Unbounded',
      'Tress of the Emerald Sea',
      'Yumi and the Nightmare Painter',
      'The Sunlit Man',
    ],
    places: [
      'Roshar',
      'Scadrial',
      'Nalthis',
      'Urithiru',
      'Alethkar',
      'Kholinar',
      'Shattered Plains',
      'Luthadel',
      'Elendel',
      'Elantris',
      'Threnody',
      'Taldain',
    ],
    legoThemeIds: [],
    // Wikidata covers Cosmere characters thinly (no Wikipedia articles yet): these are the main
    // ones it lists, from Stormlight and Mistborn.
    characters: [
      {
        slug: 'kaladin',
        name: 'Kaladin',
        wikidataId: 'Q109339484',
        aliases: ['Stormblessed', 'Kal'],
      },
      {
        slug: 'shallan-davar',
        name: 'Shallan Davar',
        wikidataId: 'Q115258050',
        aliases: ['Shallan'],
      },
      {
        slug: 'dalinar-kholin',
        name: 'Dalinar Kholin',
        wikidataId: 'Q115258005',
        aliases: ['Dalinar', 'The Blackthorn'],
      },
      {
        slug: 'adolin-kholin',
        name: 'Adolin Kholin',
        wikidataId: 'Q117084292',
        aliases: ['Adolin'],
      },
      {
        slug: 'jasnah-kholin',
        name: 'Jasnah Kholin',
        wikidataId: 'Q115258165',
        aliases: ['Jasnah'],
      },
      {
        slug: 'szeth',
        name: 'Szeth',
        wikidataId: 'Q115258150',
        aliases: ['Szeth-son-son-Vallano'],
      },
      { slug: 'sylphrena', name: 'Sylphrena', wikidataId: 'Q121075942', aliases: ['Syl'] },
      { slug: 'venli', name: 'Venli', wikidataId: 'Q121075712' },
      { slug: 'eshonai', name: 'Eshonai', wikidataId: 'Q115258141' },
      {
        slug: 'kelsier',
        name: 'Kelsier',
        wikidataId: 'Q18535363',
        aliases: ['Survivor of Hathsin', 'The Survivor'],
      },
      // "Vin" is also wine and a vehicle number; "Hoid" wanders through every Cosmere book.
      {
        slug: 'vin',
        name: 'Vin',
        wikidataId: 'Q18535399',
        aliases: ['Vin Venture'],
        ambiguous: true,
      },
      { slug: 'elend-venture', name: 'Elend Venture', wikidataId: 'Q73890176', aliases: ['Elend'] },
      { slug: 'sazed', name: 'Sazed', wikidataId: 'Q61710205' },
      {
        slug: 'lord-ruler',
        name: 'The Lord Ruler',
        wikidataId: 'Q18535424',
        aliases: ['Rashek'],
      },
      {
        slug: 'waxillium-ladrian',
        name: 'Waxillium Ladrian',
        wikidataId: 'Q121076114',
        aliases: ['Wax'],
      },
      { slug: 'hoid', name: 'Hoid', wikidataId: 'Q117188744', ambiguous: true },
    ],
  },
  {
    slug: 'one-piece',
    name: 'One Piece',
    wikidataId: 'Q16682047',
    description: "Eiichiro Oda's pirate world of Luffy, the Straw Hat crew and the Grand Line.",
    titleAliases: ['One Piece', 'Straw Hat Pirates'],
    places: [
      'Grand Line',
      'East Blue',
      'Wano Country',
      'Wano',
      'Alabasta',
      'Water 7',
      'Skypiea',
      'Marineford',
      'Dressrosa',
      'Enies Lobby',
      'Thriller Bark',
      'Fish-Man Island',
      'Laugh Tale',
      'Arlong Park',
    ],
    legoThemeIds: [775],
    // "In one piece", "one piece at a time", one-piece sewing, knitting and swimwear.
    excludePhrases: [
      'in one piece',
      'one piece at a time',
      'one piece of',
      'one piece swimsuit',
      'swimwear',
      'sewing',
      'knitting',
      'knits',
      'crocheting',
      'dressmaking',
      'wearables',
    ],
    characters: [
      {
        slug: 'monkey-d-luffy',
        name: 'Monkey D. Luffy',
        wikidataId: 'Q477948',
        aliases: ['Luffy', 'Straw Hat Luffy', 'Monkey D Luffy'],
        titleNames: ['Luffy'],
      },
      { slug: 'roronoa-zoro', name: 'Roronoa Zoro', wikidataId: 'Q858432', aliases: ['Zoro'] },
      { slug: 'nami', name: 'Nami', wikidataId: 'Q877964', ambiguous: true },
      { slug: 'sanji', name: 'Sanji', wikidataId: 'Q1061765', aliases: ['Vinsmoke Sanji'] },
      { slug: 'nico-robin', name: 'Nico Robin', wikidataId: 'Q1190653' },
      {
        slug: 'tony-tony-chopper',
        name: 'Tony Tony Chopper',
        wikidataId: 'Q1152213',
        aliases: ['Chopper'],
        titleNames: ['Tony Tony Chopper'],
      },
      { slug: 'usopp', name: 'Usopp', wikidataId: 'Q1078696', aliases: ['Sogeking'] },
      {
        slug: 'franky',
        name: 'Franky',
        wikidataId: 'Q1190670',
        aliases: ['Cutty Flam'],
        ambiguous: true,
      },
      {
        slug: 'portgas-d-ace',
        name: 'Portgas D. Ace',
        wikidataId: 'Q2084755',
        aliases: ['Fire Fist Ace', 'Gol D. Ace'],
      },
      {
        slug: 'brook',
        name: 'Brook',
        wikidataId: 'Q4376780',
        aliases: ['Soul King'],
        ambiguous: true,
      },
      {
        slug: 'shanks',
        name: 'Shanks',
        wikidataId: 'Q2321523',
        aliases: ['Red-Haired Shanks'],
        ambiguous: true,
      },
      {
        slug: 'gol-d-roger',
        name: 'Gol D. Roger',
        wikidataId: 'Q2619344',
        aliases: ['Gold Roger'],
      },
      { slug: 'boa-hancock', name: 'Boa Hancock', wikidataId: 'Q2359852' },
      { slug: 'arlong', name: 'Arlong', wikidataId: 'Q6856289' },
      { slug: 'jinbe', name: 'Jinbe', wikidataId: 'Q1041837', aliases: ['Jinbei'] },
      {
        slug: 'dracule-mihawk',
        name: 'Dracule Mihawk',
        wikidataId: 'Q2640110',
        aliases: ['Mihawk'],
      },
      {
        slug: 'smoker',
        name: 'Smoker',
        wikidataId: 'Q2727057',
        aliases: ['Captain Smoker'],
        ambiguous: true,
      },
      {
        slug: 'trafalgar-law',
        name: 'Trafalgar Law',
        wikidataId: 'Q3997231',
        aliases: ['Trafalgar D. Water Law'],
      },
      {
        slug: 'buggy',
        name: 'Buggy',
        wikidataId: 'Q2605496',
        aliases: ['Buggy the Clown'],
        ambiguous: true,
      },
      {
        slug: 'whitebeard',
        name: 'Whitebeard',
        wikidataId: 'Q2720493',
        aliases: ['Edward Newgate'],
        ambiguous: true,
      },
      {
        slug: 'crocodile',
        name: 'Crocodile',
        wikidataId: 'Q2726975',
        aliases: ['Sir Crocodile'],
        ambiguous: true,
      },
      {
        slug: 'donquixote-doflamingo',
        name: 'Donquixote Doflamingo',
        wikidataId: 'Q1404614',
        aliases: ['Doflamingo'],
      },
    ],
  },
  {
    slug: 'pokemon',
    name: 'Pokémon',
    wikidataId: 'Q17562848',
    description: 'The world of Pokémon trainers, from Pikachu and Ash Ketchum to every region.',
    // Not Kanto: it's also the region of Japan around Tokyo.
    titleAliases: ['Pokémon', 'Pocket Monsters', 'Pokédex'],
    places: [
      'Johto',
      'Hoenn',
      'Sinnoh',
      'Unova',
      'Kalos',
      'Alola',
      'Galar',
      'Paldea',
      'Pallet Town',
    ],
    legoThemeIds: [776],
    // LEGO's Pokémon are brick-built (no minifigs), so sets name them in the title.
    characters: [
      { slug: 'pikachu', name: 'Pikachu', wikidataId: 'Q9351', titleNames: ['Pikachu'] },
      {
        slug: 'ash-ketchum',
        name: 'Ash Ketchum',
        wikidataId: 'Q308950',
        aliases: ['Ash'],
        titleNames: ['Ash Ketchum'],
      },
      { slug: 'misty', name: 'Misty', wikidataId: 'Q1057356', ambiguous: true },
      { slug: 'brock', name: 'Brock', wikidataId: 'Q864918', ambiguous: true },
      { slug: 'serena', name: 'Serena', wikidataId: 'Q17221976', ambiguous: true },
      { slug: 'bulbasaur', name: 'Bulbasaur', wikidataId: 'Q847571', titleNames: ['Bulbasaur'] },
      {
        slug: 'charmander',
        name: 'Charmander',
        wikidataId: 'Q3178753',
        titleNames: ['Charmander'],
      },
      { slug: 'charizard', name: 'Charizard', wikidataId: 'Q844940', titleNames: ['Charizard'] },
      { slug: 'squirtle', name: 'Squirtle', wikidataId: 'Q845294', titleNames: ['Squirtle'] },
      {
        slug: 'jigglypuff',
        name: 'Jigglypuff',
        wikidataId: 'Q1753198',
        titleNames: ['Jigglypuff'],
      },
      { slug: 'mewtwo', name: 'Mewtwo', wikidataId: 'Q2141803', titleNames: ['Mewtwo'] },
      { slug: 'mew', name: 'Mew', wikidataId: 'Q12342580', ambiguous: true },
      { slug: 'eevee', name: 'Eevee', wikidataId: 'Q1263559', titleNames: ['Eevee'] },
      { slug: 'meowth', name: 'Meowth', wikidataId: 'Q877650', titleNames: ['Meowth'] },
      { slug: 'psyduck', name: 'Psyduck', wikidataId: 'Q2089060', titleNames: ['Psyduck'] },
      { slug: 'snorlax', name: 'Snorlax', wikidataId: 'Q2480066', titleNames: ['Snorlax'] },
      { slug: 'gengar', name: 'Gengar', wikidataId: 'Q2250743', titleNames: ['Gengar'] },
      { slug: 'lucario', name: 'Lucario', wikidataId: 'Q1154303', titleNames: ['Lucario'] },
      { slug: 'magikarp', name: 'Magikarp', wikidataId: 'Q2822418', titleNames: ['Magikarp'] },
      { slug: 'mudkip', name: 'Mudkip', wikidataId: 'Q1253950', titleNames: ['Mudkip'] },
      { slug: 'raichu', name: 'Raichu', wikidataId: 'Q1647331', titleNames: ['Raichu'] },
      { slug: 'rayquaza', name: 'Rayquaza', wikidataId: 'Q1149899', titleNames: ['Rayquaza'] },
    ],
  },
  {
    slug: 'jurassic-park',
    name: 'Jurassic Park',
    wikidataId: 'Q17862095',
    description:
      "Michael Crichton's dinosaur parks: the novels and the Jurassic Park and Jurassic World films.",
    // Not "The Lost World": Conan Doyle's novel shares the title. Crichton's lists Isla Sorna
    // and Ian Malcolm, and its subjects name Jurassic Park.
    titleAliases: ['Jurassic Park', 'Jurassic World', 'Camp Cretaceous'],
    places: ['Isla Nublar', 'Isla Sorna'],
    // Jurassic World, Jurassic Park III, Juniors Fallen Kingdom, Duplo Jurassic World
    legoThemeIds: [602, 274, 620, 722],
    // Wikidata lists 12 characters; these are its people and named dinosaurs.
    characters: [
      {
        slug: 'ian-malcolm',
        name: 'Ian Malcolm',
        wikidataId: 'Q14916129',
        aliases: ['Dr. Ian Malcolm'],
      },
      // Also a Scottish comics writer, and a blues musician and record producer.
      { slug: 'alan-grant', name: 'Alan Grant', wikidataId: 'Q2543708', ambiguous: true },
      { slug: 'john-hammond', name: 'John Hammond', wikidataId: 'Q324322', ambiguous: true },
      { slug: 'ellie-sattler', name: 'Ellie Sattler', wikidataId: 'Q14916141' },
      { slug: 'owen-grady', name: 'Owen Grady', wikidataId: 'Q20890036' },
      { slug: 'claire-dearing', name: 'Claire Dearing', wikidataId: 'Q113549459' },
      { slug: 'maisie-lockwood', name: 'Maisie Lockwood', wikidataId: 'Q113853555' },
      {
        slug: 'robert-muldoon',
        name: 'Robert Muldoon',
        wikidataId: 'Q12049518',
        aliases: ['Muldoon'],
      },
      { slug: 'dennis-nedry', name: 'Dennis Nedry', wikidataId: 'Q13221658' },
      { slug: 'rexy', name: 'Rexy', wikidataId: 'Q114656241', ambiguous: true },
      { slug: 'blue', name: 'Blue', wikidataId: 'Q126189797', ambiguous: true },
    ],
  },
  {
    slug: 'disney-pixar',
    name: 'Disney & Pixar',
    wikidataId: 'Q3551225',
    description:
      'Walt Disney Animation and Pixar: Mickey Mouse, the princesses, Toy Story, Frozen, Cars and more.',
    // Never "Disney" alone: Disney publishes Star Wars and Marvel books and owns both. Not
    // film titles that are fairy tales ("The Little Mermaid", "Beauty and the Beast") or other
    // books' words ("Tangled", "Encanto", "Ratatouille", "Cars", "Frozen", "Moana").
    titleAliases: [
      'Disney Pixar',
      'Disney Princess',
      'Disney Frozen',
      'Frozen II',
      'Toy Story',
      'Finding Nemo',
      'Finding Dory',
      'Monsters, Inc.',
      'Monsters University',
      'The Incredibles',
      'Incredibles 2',
      'The Lion King',
      'Lilo & Stitch',
      'Lilo and Stitch',
      'Zootopia',
      'Wreck-It Ralph',
      'Raya and the Last Dragon',
      'Lady and the Tramp',
      'WALL-E',
    ],
    places: ['Arendelle', 'Pride Rock', 'Radiator Springs', 'Monstropolis', 'Agrabah', 'Motunui'],
    // Disney, Cars, Juniors Cars / Incredibles 2 / Disney Princess, Disney minifigure series
    // 1, 2 and 100, Disney Advent, Duplo Disney
    legoThemeIds: [608, 269, 615, 783, 593, 555, 677, 745, 780, 754],
    // Live-action: Pirates of the Caribbean, Prince of Persia (both under Disney)
    excludeLegoThemeIds: [263, 271],
    // Most of Disney's leads share their name with a fairy tale, a legend or a person, so
    // they only count where something else says Disney.
    characters: [
      {
        slug: 'mickey-mouse',
        name: 'Mickey Mouse',
        wikidataId: 'Q11934',
        aliases: ['Mickey'],
        titleNames: ['Mickey Mouse'],
      },
      {
        slug: 'minnie-mouse',
        name: 'Minnie Mouse',
        wikidataId: 'Q11936',
        aliases: ['Minnie'],
        titleNames: ['Minnie Mouse'],
      },
      {
        slug: 'donald-duck',
        name: 'Donald Duck',
        wikidataId: 'Q6550',
        titleNames: ['Donald Duck'],
      },
      { slug: 'goofy', name: 'Goofy', wikidataId: 'Q111135', ambiguous: true },
      {
        slug: 'elsa',
        name: 'Elsa',
        wikidataId: 'Q15620419',
        aliases: ['Queen Elsa'],
        ambiguous: true,
      },
      {
        slug: 'anna',
        name: 'Anna',
        wikidataId: 'Q15614636',
        aliases: ['Princess Anna'],
        ambiguous: true,
      },
      { slug: 'olaf', name: 'Olaf', wikidataId: 'Q16253807', ambiguous: true },
      { slug: 'simba', name: 'Simba', wikidataId: 'Q1649583', ambiguous: true },
      {
        slug: 'woody',
        name: 'Woody',
        wikidataId: 'Q2290907',
        aliases: ['Sheriff Woody'],
        ambiguous: true,
      },
      {
        slug: 'buzz-lightyear',
        name: 'Buzz Lightyear',
        wikidataId: 'Q1986193',
        titleNames: ['Buzz Lightyear'],
      },
      { slug: 'jessie', name: 'Jessie', wikidataId: 'Q2200623', ambiguous: true },
      {
        slug: 'lightning-mcqueen',
        name: 'Lightning McQueen',
        wikidataId: 'Q864418',
        titleNames: ['Lightning McQueen'],
      },
      {
        slug: 'mater',
        name: 'Mater',
        wikidataId: 'Q6786487',
        aliases: ['Tow Mater'],
        ambiguous: true,
      },
      { slug: 'ariel', name: 'Ariel', wikidataId: 'Q892442', ambiguous: true },
      { slug: 'belle', name: 'Belle', wikidataId: 'Q2502489', ambiguous: true },
      { slug: 'maleficent', name: 'Maleficent', wikidataId: 'Q1660555' },
      { slug: 'stitch', name: 'Stitch', wikidataId: 'Q602854', ambiguous: true },
      { slug: 'moana', name: 'Moana', wikidataId: 'Q21233695', ambiguous: true },
      { slug: 'rapunzel', name: 'Rapunzel', wikidataId: 'Q4902053', ambiguous: true },
      { slug: 'mulan', name: 'Mulan', wikidataId: 'Q246838', ambiguous: true },
      // Dodie Smith's novel came first.
      { slug: 'cruella-de-vil', name: 'Cruella de Vil', wikidataId: 'Q388605', ambiguous: true },
      {
        slug: 'mr-incredible',
        name: 'Mr. Incredible',
        wikidataId: 'Q616658',
        aliases: ['Bob Parr'],
      },
      { slug: 'elastigirl', name: 'Elastigirl', wikidataId: 'Q3134305', aliases: ['Helen Parr'] },
      { slug: 'mike-wazowski', name: 'Mike Wazowski', wikidataId: 'Q2907795' },
      {
        slug: 'james-p-sullivan',
        name: 'James P. Sullivan',
        wikidataId: 'Q3160045',
        aliases: ['Sulley'],
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
