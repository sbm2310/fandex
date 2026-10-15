import type { DateChange } from '@fandex/core';

import { countdownText, delayText, timelineDate } from '@/utils/preorder-text';

const today = '2026-10-11';

describe('timeline dates', () => {
  it('puts the finer part large', () => {
    expect(timelineDate({ date: '2026-11-10', precision: 'day' })).toEqual({
      small: 'NOV',
      big: '10',
    });
    expect(timelineDate({ date: '2027-03-01', precision: 'month' })).toEqual({
      small: '2027',
      big: 'MAR',
    });
    expect(timelineDate({ date: '2027-04-01', precision: 'quarter' })).toEqual({
      small: '2027',
      big: 'Q2',
    });
    expect(timelineDate({ date: '2027-01-01', precision: 'year' })).toEqual({
      small: '',
      big: '2027',
    });
  });
});

describe('countdowns', () => {
  it('counts days, then months, then years', () => {
    expect(countdownText({ date: today, precision: 'day' }, today)).toBe('this day');
    expect(countdownText({ date: '2026-10-12', precision: 'day' }, today)).toBe('tomorrow');
    expect(countdownText({ date: '2026-11-06', precision: 'day' }, today)).toBe('in 26 days');
    expect(countdownText({ date: '2027-03-01', precision: 'month' }, today)).toBe('in 5 months');
    expect(countdownText({ date: '2029-01-01', precision: 'year' }, today)).toBe('in 2 years');
  });

  it('says "this month" inside a vaguer period, and nothing once it is over', () => {
    expect(countdownText({ date: '2026-10-01', precision: 'month' }, today)).toBe('this month');
    expect(countdownText({ date: '2026-10-01', precision: 'quarter' }, today)).toBe('this quarter');
    expect(countdownText({ date: '2026-09-01', precision: 'month' }, today)).toBeUndefined();
  });
});

describe('delays', () => {
  const change = (from: string | null, to: string): DateChange => ({
    from: from === null ? null : { date: from, precision: 'month' },
    to: { date: to, precision: 'month' },
    changedAt: `${to}T00:00:00.000Z`,
    source: 'user',
  });

  it('counts only moves to a later date', () => {
    expect(delayText([change(null, '2027-03-01')])).toBeUndefined();
    expect(delayText([change(null, '2027-03-01'), change('2027-03-01', '2027-06-01')])).toBe(
      'Delayed once',
    );
    expect(
      delayText([
        change(null, '2027-03-01'),
        change('2027-03-01', '2027-06-01'),
        change('2027-06-01', '2027-09-01'),
      ]),
    ).toBe('Delayed twice');
  });
});
