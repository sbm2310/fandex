import {
  balanceLeft,
  formatMoney,
  formatRelease,
  type AttentionReason,
  type Currency,
  type PreorderResponse,
} from '@fandex/core';

/** "October 18, 2026" for a YYYY-MM-DD. */
export const day = (value: string) => formatRelease({ date: value, precision: 'day' });

/** One sentence per thing to do: "Balance of $280.00 due October 18, 2026". */
export function attentionText(reason: AttentionReason, preorder: PreorderResponse): string {
  const left = balanceLeft(preorder);
  const owed = left ? `Balance of ${formatMoney(left, preorder.currency as Currency)}` : 'Balance';
  switch (reason.kind) {
    case 'payment-overdue':
      return `${owed} was due ${day(reason.day)}`;
    case 'payment-due':
      return `${owed} due ${day(reason.day)}`;
    case 'release-passed':
      return `Expected ${formatRelease(reason.release)}: has it arrived? Mark it, or update the date.`;
    case 'arriving-soon':
      return `Arriving ${day(reason.day)}`;
  }
}
