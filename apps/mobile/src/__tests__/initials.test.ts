import { initials } from '@/utils/initials';

describe('initials', () => {
  it.each([
    ['Darth Vader', 'DV'],
    ['Gandalf', 'G'],
    ['Aragorn (The Fellowship of the Ring)', 'A'],
    ['Darth Vader [Deluxe]', 'DV'],
    ['"Weird" Al', 'A'],
    ['', ''],
  ])('%s → %s', (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});
