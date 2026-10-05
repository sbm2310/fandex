import { isCategory } from './category';

describe('isCategory', () => {
  it.each(['book', 'manga', 'comic', 'lego'])('accepts %s', (category) => {
    expect(isCategory(category)).toBe(true);
  });

  it('rejects an unsupported category', () => {
    expect(isCategory('vinyl')).toBe(false);
  });
});
