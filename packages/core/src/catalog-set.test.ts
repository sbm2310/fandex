import { displaySetNumber, parseSetNumber } from './catalog-set';

describe('LEGO set numbers', () => {
  it.each([
    ['75192', '75192-1'],
    [' 75192-1 ', '75192-1'],
    ['10179-2', '10179-2'],
    ['comcon001', 'comcon001-1'],
  ])('parses %j as %s', (input, expected) => {
    expect(parseSetNumber(input)).toBe(expected);
  });

  it.each(['', 'x', 'millennium falcon', '75192-', '75192-1-1'])('rejects %j', (input) => {
    expect(parseSetNumber(input)).toBeNull();
  });

  it('drops the -1 suffix for display only', () => {
    expect(displaySetNumber('75192-1')).toBe('75192');
    expect(displaySetNumber('10179-2')).toBe('10179-2');
  });
});
