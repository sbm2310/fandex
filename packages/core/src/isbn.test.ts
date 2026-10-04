import {
  isBookBarcode,
  isValidIsbn10,
  isValidIsbn13,
  isbn10To13,
  looksLikeIsbn,
  normalizeIsbn,
  parseIsbn,
} from './isbn';

// Reference values: Wikipedia's ISBN examples, plus an ISBN-10 with an X check digit.
const ISBN10 = '0-306-40615-2';
const ISBN13 = '978-0-306-40615-7';
const ISBN10_WITH_X = '080442957X';
const ISBN13_FROM_X = '9780804429573';
const ISBN13_979 = '979-10-90636-07-1';
const ISMN = '979-0-2600-0043-8'; // valid EAN-13, but sheet music, not a book

describe('normalizeIsbn', () => {
  it('removes hyphens and spaces', () => {
    expect(normalizeIsbn(' 978-0 306-40615-7 ')).toBe('9780306406157');
  });

  it('upper-cases a trailing x', () => {
    expect(normalizeIsbn('080442957x')).toBe('080442957X');
  });
});

describe('isValidIsbn10', () => {
  it.each([ISBN10, '0306406152', ISBN10_WITH_X, '080442957x'])('accepts %s', (isbn) => {
    expect(isValidIsbn10(isbn)).toBe(true);
  });

  it.each([
    ['wrong check digit', '0306406153'],
    ['too short', '030640615'],
    ['too long', '03064061522'],
    ['X not in last position', '03064X6152'],
    ['letters', 'ABCDEFGHIJ'],
    ['empty', ''],
  ])('rejects %s', (_, isbn) => {
    expect(isValidIsbn10(isbn)).toBe(false);
  });
});

describe('isValidIsbn13', () => {
  it.each([ISBN13, '9780306406157', ISBN13_FROM_X, ISBN13_979])('accepts %s', (isbn) => {
    expect(isValidIsbn13(isbn)).toBe(true);
  });

  it.each([
    ['wrong check digit', '9780306406158'],
    ['non-book EAN-13 prefix', '4006381333931'],
    ['ISMN (979-0, printed music)', ISMN],
    ['ISBN-10', ISBN10],
    ['too short', '978030640615'],
    ['X check digit', '978030640615X'],
    ['empty', ''],
  ])('rejects %s', (_, isbn) => {
    expect(isValidIsbn13(isbn)).toBe(false);
  });
});

describe('isbn10To13', () => {
  it('adds the 978 prefix and recomputes the check digit', () => {
    expect(isbn10To13(ISBN10)).toBe('9780306406157');
  });

  it('handles an X check digit', () => {
    expect(isbn10To13(ISBN10_WITH_X)).toBe(ISBN13_FROM_X);
  });

  it('throws on an invalid ISBN-10', () => {
    expect(() => isbn10To13('0306406153')).toThrow('Not a valid ISBN-10');
  });
});

describe('parseIsbn', () => {
  it.each([
    ['ISBN-13 with hyphens', ISBN13, '9780306406157'],
    ['ISBN-13 digits only', '9780306406157', '9780306406157'],
    ['ISBN-10, converted to ISBN-13', ISBN10, '9780306406157'],
    ['ISBN-10 with X', ISBN10_WITH_X, ISBN13_FROM_X],
    ['979 prefix', ISBN13_979, '9791090636071'],
    ['surrounding whitespace', '  9780306406157\n', '9780306406157'],
  ])('parses %s', (_, input, expected) => {
    expect(parseIsbn(input)).toBe(expected);
  });

  it.each([
    ['wrong check digit', '9780306406158'],
    ['ISMN', ISMN],
    ['a title', 'The Hobbit'],
    ['empty', ''],
  ])('returns null for %s', (_, input) => {
    expect(parseIsbn(input)).toBeNull();
  });
});

describe('isBookBarcode', () => {
  it('accepts an EAN-13 book barcode', () => {
    expect(isBookBarcode('9780306406157')).toBe(true);
  });

  it.each([
    ['non-book EAN-13 (e.g. a toy or DVD)', '4006381333931'],
    ['ISMN barcode', '9790260000438'],
    ['wrong check digit', '9780306406158'],
    ['formatted ISBN (scanners return raw digits)', '978-0-306-40615-7'],
    ['UPC-A (12 digits)', '036000291452'],
  ])('rejects %s', (_, data) => {
    expect(isBookBarcode(data)).toBe(false);
  });
});

describe('looksLikeIsbn', () => {
  it.each([ISBN13, '9780306406158', ISBN10, '080442957x', ' 978 0306406157 '])(
    'is true for ISBN-shaped input %s (valid or not)',
    (input) => {
      expect(looksLikeIsbn(input)).toBe(true);
    },
  );

  it.each(['The Hobbit', '1984', '978030640615', '97803064061577', '0306X06152', ''])(
    'is false for %s',
    (input) => {
      expect(looksLikeIsbn(input)).toBe(false);
    },
  );
});
