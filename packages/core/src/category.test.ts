import { isCategory } from './category';

describe('isCategory', () => {
  it('accepts a supported category', () => {
    expect(isCategory('book')).toBe(true);
  });

  it('rejects an unsupported category', () => {
    expect(isCategory('vinyl')).toBe(false);
  });
});
