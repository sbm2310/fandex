import { createPreorderRequestSchema, updatePreorderRequestSchema } from '../contracts/preorders';

import { currencyDigits, formatMoney, moneyInputValue, parseMoney } from './money';
import {
  balanceLeft,
  describeSlips,
  groupUpcoming,
  needsAttention,
  summarizeSlips,
  type DateChange,
  type PreorderTerms,
} from './preorder';
import {
  addDays,
  compareReleases,
  daysBetween,
  formatRelease,
  releaseDate,
  releasePeriodEnd,
} from './release-date';

// "Today" in every test: Sunday, October 11, 2026.
const TODAY = '2026-10-11';

const preorder = (terms: Partial<PreorderTerms> & { name?: string } = {}) => ({
  name: 'figure',
  status: 'ordered' as const,
  currency: 'USD' as const,
  paid: 0,
  history: [],
  ...terms,
});

describe('money', () => {
  it('formats minor units in each currency', () => {
    expect(formatMoney(34999, 'USD')).toBe('$349.99');
    expect(formatMoney(4200000, 'JPY')).toBe('¥4,200,000');
    expect(formatMoney(125000, 'ILS')).toBe('₪1,250.00');
    expect(currencyDigits('JPY')).toBe(0);
  });

  it('parses what people type, exactly', () => {
    expect(parseMoney('350', 'USD')).toBe(35000);
    expect(parseMoney('349.99', 'USD')).toBe(34999);
    expect(parseMoney('0.29', 'USD')).toBe(29); // 0.29 * 100 is 28.999… as a float
    expect(parseMoney('$1,250.5', 'USD')).toBe(125050);
    expect(parseMoney(' .5 ', 'EUR')).toBe(50);
    expect(parseMoney('42000', 'JPY')).toBe(42000);
  });

  it('rejects what is not an amount, or has more decimals than the currency', () => {
    for (const input of ['', 'abc', '1.2.3', '12a']) expect(parseMoney(input, 'USD')).toBeNull();
    expect(parseMoney('349.999', 'USD')).toBeNull();
    expect(parseMoney('10.5', 'JPY')).toBeNull();
  });

  it('shows an amount back in a form field', () => {
    expect(moneyInputValue(34999, 'USD')).toBe('349.99');
    expect(moneyInputValue(35000, 'USD')).toBe('350.00');
    expect(moneyInputValue(42000, 'JPY')).toBe('42000');
  });
});

describe('release dates', () => {
  it('normalizes any day to the start of its period, and knows when the period ends', () => {
    expect(releaseDate('2027-03-17', 'month')).toEqual({ date: '2027-03-01', precision: 'month' });
    expect(releaseDate('2027-05-20', 'quarter')).toEqual({
      date: '2027-04-01',
      precision: 'quarter',
    });
    expect(releasePeriodEnd(releaseDate('2027-02-10', 'month'))).toBe('2027-02-28');
    expect(releasePeriodEnd(releaseDate('2028-02-10', 'month'))).toBe('2028-02-29'); // leap year
    expect(releasePeriodEnd(releaseDate('2027-11-01', 'quarter'))).toBe('2027-12-31');
    expect(releasePeriodEnd(releaseDate('2027-06-01', 'year'))).toBe('2027-12-31');
  });

  it('reads the way stores announce them', () => {
    expect(formatRelease(releaseDate('2027-03-12', 'day'))).toBe('March 12, 2027');
    expect(formatRelease(releaseDate('2027-03-12', 'month'))).toBe('March 2027');
    expect(formatRelease(releaseDate('2027-08-12', 'quarter'))).toBe('Q3 2027');
    expect(formatRelease(releaseDate('2027-08-12', 'year'))).toBe('2027');
  });

  it('orders by when the promise runs out', () => {
    const march = releaseDate('2027-03-01', 'month');
    const q1 = releaseDate('2027-01-01', 'quarter');
    const march31 = releaseDate('2027-03-31', 'day');
    expect(compareReleases(releaseDate('2027-02-15', 'day'), march)).toBeLessThan(0);
    // Same last day: the finer promise first.
    expect(compareReleases(march31, march)).toBeLessThan(0);
    expect(compareReleases(march, q1)).toBeLessThan(0);
    expect(daysBetween('2026-10-11', '2026-10-18')).toBe(7);
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
  });
});

describe('needsAttention', () => {
  it('flags a balance due within a week, or overdue', () => {
    const owing = { price: 35000, paid: 7000 };
    expect(needsAttention(preorder({ ...owing, balanceDueDate: '2026-10-18' }), TODAY)).toEqual([
      { kind: 'payment-due', day: '2026-10-18' },
    ]);
    expect(needsAttention(preorder({ ...owing, balanceDueDate: '2026-10-10' }), TODAY)).toEqual([
      { kind: 'payment-overdue', day: '2026-10-10' },
    ]);
    // Not yet, already paid, or price unknown: nothing to do.
    expect(needsAttention(preorder({ ...owing, balanceDueDate: '2026-10-19' }), TODAY)).toEqual([]);
    expect(
      needsAttention(preorder({ price: 35000, paid: 35000, balanceDueDate: '2026-10-12' }), TODAY),
    ).toEqual([]);
    expect(needsAttention(preorder({ balanceDueDate: '2026-10-12' }), TODAY)).toEqual([]);
  });

  it('flags a release this week, or one whose whole period has passed', () => {
    expect(
      needsAttention(preorder({ expectedRelease: releaseDate('2026-10-15', 'day') }), TODAY),
    ).toEqual([{ kind: 'arriving-soon', day: '2026-10-15' }]);
    // "September 2026" is over; "October 2026" isn't yet, even though it started.
    expect(
      needsAttention(preorder({ expectedRelease: releaseDate('2026-09-01', 'month') }), TODAY),
    ).toEqual([{ kind: 'release-passed', release: releaseDate('2026-09-01', 'month') }]);
    expect(
      needsAttention(preorder({ expectedRelease: releaseDate('2026-10-01', 'month') }), TODAY),
    ).toEqual([]);
  });

  it('ignores arrived and cancelled pre-orders', () => {
    const late = { price: 100, balanceDueDate: '2026-01-01' };
    expect(needsAttention(preorder({ ...late, status: 'arrived' }), TODAY)).toEqual([]);
    expect(needsAttention(preorder({ ...late, status: 'cancelled' }), TODAY)).toEqual([]);
  });

  it('works out the balance', () => {
    expect(balanceLeft({ price: 35000, paid: 7000 })).toBe(28000);
    expect(balanceLeft({ price: 100, paid: 150 })).toBe(0);
    expect(balanceLeft({ paid: 7000 })).toBeUndefined();
  });
});

describe('groupUpcoming', () => {
  it('sorts open pre-orders into what needs doing, this month, later and undated', () => {
    const groups = groupUpcoming(
      [
        preorder({ name: 'later', expectedRelease: releaseDate('2027-03-01', 'month') }),
        preorder({ name: 'q4', expectedRelease: releaseDate('2026-10-01', 'quarter') }),
        preorder({ name: 'october', expectedRelease: releaseDate('2026-10-01', 'month') }),
        preorder({ name: 'no date', price: 5000 }),
        preorder({ name: 'arriving', expectedRelease: releaseDate('2026-10-14', 'day') }),
        preorder({ name: 'overdue', price: 35000, paid: 7000, balanceDueDate: '2026-10-01' }),
        preorder({ name: 'late', expectedRelease: releaseDate('2026-08-01', 'month') }),
        preorder({ name: 'yen', currency: 'JPY', price: 42000, paid: 10000 }),
        preorder({ name: 'arrived', status: 'arrived', price: 9900 }),
      ],
      TODAY,
    );

    expect(groups.attention.map(({ preorder: p }) => p.name)).toEqual([
      'overdue',
      'late',
      'arriving',
    ]);
    expect(groups.thisMonth.map((p) => p.name)).toEqual(['october']);
    expect(groups.later.map((p) => p.name)).toEqual(['q4', 'later']); // Q4 ends in December
    expect(groups.noDate.map((p) => p.name)).toEqual(['no date', 'yen']);
    expect(groups.owed).toEqual({ USD: 28000 + 5000, JPY: 32000 });
  });
});

describe('slips', () => {
  const at = (day: string) => `${day}T09:00:00.000Z`;
  const march = releaseDate('2027-03-01', 'month');
  const june = releaseDate('2027-06-01', 'month');
  const q3 = releaseDate('2027-07-01', 'quarter');

  it('counts moves to a later date as delays, from the first date set', () => {
    const history: DateChange[] = [
      { from: june, to: q3, changedAt: at('2026-12-01'), source: 'user' },
      { from: null, to: march, changedAt: at('2026-10-11'), source: 'user' },
      { from: march, to: june, changedAt: at('2026-11-01'), source: 'openlibrary' },
    ];

    expect(summarizeSlips(history)).toEqual({ delays: 2, original: march });
    expect(describeSlips(history)).toBe('Delayed twice, originally March 2027');
  });

  it('does not count a date set, cleared or moved earlier', () => {
    const history: DateChange[] = [
      { from: null, to: june, changedAt: at('2026-10-11'), source: 'user' },
      { from: june, to: march, changedAt: at('2026-10-12'), source: 'user' },
      { from: march, to: null, changedAt: at('2026-10-13'), source: 'user' },
    ];

    expect(describeSlips(history)).toBeUndefined();
    expect(describeSlips([])).toBeUndefined();
    expect(
      describeSlips([
        { from: march, to: june, changedAt: at('2026-10-11'), source: 'user' },
        { from: june, to: q3, changedAt: at('2026-10-12'), source: 'user' },
        {
          from: q3,
          to: releaseDate('2028-01-01', 'year'),
          changedAt: at('2026-10-13'),
          source: 'user',
        },
      ]),
    ).toBe('Delayed 3 times, originally March 2027');
  });
});

describe('pre-order requests', () => {
  const catalogItemId = '0199b5a0-0000-7000-8000-000000000001';

  it('fills defaults, trims text and normalizes the expected date', () => {
    expect(
      createPreorderRequestSchema.parse({
        catalogItemId,
        price: 35000,
        store: '  Sideshow ',
        notes: '   ',
        expectedRelease: { date: '2027-03-17', precision: 'month' },
      }),
    ).toEqual({
      catalogItemId,
      currency: 'USD',
      price: 35000,
      paid: 0,
      store: 'Sideshow',
      notes: undefined,
      expectedRelease: { date: '2027-03-01', precision: 'month' },
    });
  });

  it('refuses paying more than the price, odd amounts and links', () => {
    expect(
      createPreorderRequestSchema.safeParse({ catalogItemId, price: 100, paid: 200 }).success,
    ).toBe(false);
    expect(createPreorderRequestSchema.safeParse({ catalogItemId, price: 12.5 }).success).toBe(
      false,
    );
    expect(createPreorderRequestSchema.safeParse({ catalogItemId, price: -1 }).success).toBe(false);
    expect(
      createPreorderRequestSchema.safeParse({ catalogItemId, orderUrl: 'javascript:alert(1)' })
        .success,
    ).toBe(false);
  });

  it('updates only what is sent, clears with null, and needs something to change', () => {
    expect(updatePreorderRequestSchema.parse({ price: null, status: 'cancelled' })).toEqual({
      price: null,
      status: 'cancelled',
    });
    expect(updatePreorderRequestSchema.safeParse({}).success).toBe(false);
    expect(updatePreorderRequestSchema.safeParse({ status: 'arrived' }).success).toBe(false);
  });
});
