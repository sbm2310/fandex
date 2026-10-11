import { isBookCategory } from './category';

describe('isBookCategory', () => {
  it.each(['book', 'manga', 'comic'])('accepts %s', (category) => {
    expect(isBookCategory(category)).toBe(true);
  });

  it('rejects LEGO', () => {
    expect(isBookCategory('lego')).toBe(false);
  });
});
