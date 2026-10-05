import { isBookCategory, isCategory } from './category';

describe('isCategory', () => {
  it.each(['book', 'manga', 'comic', 'lego'])('accepts %s', (category) => {
    expect(isCategory(category)).toBe(true);
  });

  it('rejects an unsupported category', () => {
    expect(isCategory('vinyl')).toBe(false);
  });
});

describe('isBookCategory', () => {
  it.each(['book', 'manga', 'comic'])('accepts %s', (category) => {
    expect(isBookCategory(category)).toBe(true);
  });

  it('rejects LEGO', () => {
    expect(isBookCategory('lego')).toBe(false);
  });
});
