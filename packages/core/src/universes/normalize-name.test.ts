import {
  cleanMinifigNames,
  cleanPersonName,
  cleanPlaceName,
  containsPhrase,
  normalizeName,
  normalizeText,
  parseSubject,
  subjectText,
} from './normalize-name';

describe('normalizeText', () => {
  it('lowercases, drops accents and apostrophes, and turns punctuation into single spaces', () => {
    expect(normalizeText('  Glóin’s  Spider-Man!  ')).toBe('gloins spider man');
    expect(normalizeText("Ra's al Ghul")).toBe('ras al ghul');
    expect(normalizeText('Middle-earth')).toBe(normalizeText('Middle Earth'));
    expect(normalizeText('S.H.I.E.L.D.')).toBe('s h i e l d');
  });
});

describe('normalizeName', () => {
  it('ignores a leading "the"', () => {
    expect(normalizeName('The Joker')).toBe('joker');
    expect(normalizeName('the Shire')).toBe('shire');
    expect(normalizeName('Theoden')).toBe('theoden');
  });
});

describe('containsPhrase', () => {
  it('matches whole words only', () => {
    expect(containsPhrase('the hobbit an unexpected journey', 'hobbit')).toBe(true);
    expect(containsPhrase('batman year one', 'batman')).toBe(true);
    expect(containsPhrase('bats of the world', 'bat')).toBe(false);
    expect(containsPhrase('thorin and company', 'thor')).toBe(false);
    expect(containsPhrase('anything', '')).toBe(false);
  });
});

describe('cleanPersonName', () => {
  it('drops parentheses and turns "Last, First" around', () => {
    expect(cleanPersonName('Batman (Fictitious character)')).toBe('batman');
    expect(cleanPersonName('Skywalker, Luke')).toBe('luke skywalker');
    expect(cleanPersonName('Leia, princess')).toBe('princess leia');
    expect(cleanPersonName('J. R. R. Tolkien (1892-1973)')).toBe('j r r tolkien');
  });

  it('leaves names with more than one comma alone', () => {
    expect(cleanPersonName('Smith, John, Jr.')).toBe('smith john jr');
  });
});

describe('cleanMinifigNames', () => {
  it('cuts the outfit details Rebrickable adds after a dash, comma or "with"', () => {
    expect(cleanMinifigNames('Gandalf The Grey - Cape, Hat')).toEqual(['gandalf the grey']);
    expect(cleanMinifigNames('Frodo  - Dark Green Cape, Reddish Brown Torso')).toEqual(['frodo']);
    expect(cleanMinifigNames('Han Solo, Old, Angry')).toEqual(['han solo']);
    expect(cleanMinifigNames('The Joker with Green Vest and White Face Make-up')).toEqual([
      'joker',
    ]);
  });

  it('drops parentheses and splits alternative names', () => {
    expect(cleanMinifigNames('Glóin (Gloin) - White Hair')).toEqual(['gloin']);
    expect(cleanMinifigNames('Spider-Man (Miles Morales), Dark Red Hoodie')).toEqual([
      'spider man',
    ]);
    expect(cleanMinifigNames('Dr. Octopus / Doc Ock, Dark Green Outfit')).toEqual([
      'dr octopus',
      'doc ock',
    ]);
  });

  it('keeps names that only contain hyphens', () => {
    expect(cleanMinifigNames('BB-8')).toEqual(['bb 8']);
    expect(cleanMinifigNames('C-3PO, Pearl Gold')).toEqual(['c 3po']);
  });
});

describe('cleanPlaceName', () => {
  it('drops parentheses without turning names around', () => {
    expect(cleanPlaceName('Hogwarts School of Witchcraft and Wizardry (Imaginary place)')).toBe(
      'hogwarts school of witchcraft and wizardry',
    );
    expect(cleanPlaceName('Paris, France')).toBe('paris france');
  });
});

describe('parseSubject', () => {
  it('reads characters and places from the exact Open Library forms', () => {
    expect(parseSubject('Gandalf (Fictitious character)')).toEqual({ person: 'gandalf' });
    expect(parseSubject('Harry Potter (Fictional character)')).toEqual({ person: 'harry potter' });
    expect(parseSubject('Avengers (Fictitious characters)')).toEqual({ person: 'avengers' });
    expect(parseSubject('Middle Earth (Imaginary place)')).toEqual({ place: 'middle earth' });
  });

  it('ignores the ", fiction" variants merged in from other editions', () => {
    expect(parseSubject('Baggins, frodo (fictitious character), fiction')).toBeNull();
    expect(parseSubject('Middle earth (imaginary place), fiction')).toBeNull();
    expect(parseSubject('Fantasy fiction')).toBeNull();
  });
});

describe('subjectText', () => {
  it('drops parentheses so the rest can be phrase-matched', () => {
    expect(subjectText('Hobbit, an unexpected journey (Motion picture)')).toBe(
      'hobbit an unexpected journey',
    );
    expect(subjectText('Star Wars fiction')).toBe('star wars fiction');
  });
});
