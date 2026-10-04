import { formatTitle } from './catalog-book';

describe('formatTitle', () => {
  it('joins title and subtitle', () => {
    expect(formatTitle({ title: 'Mistborn', subtitle: 'The Final Empire' })).toBe(
      'Mistborn: The Final Empire',
    );
  });

  it('returns the title alone when there is no subtitle', () => {
    expect(formatTitle({ title: 'Dune' })).toBe('Dune');
  });
});
