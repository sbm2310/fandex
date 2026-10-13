/**
 * Money as integer minor units (cents) with an ISO 4217 currency code: never floating point,
 * so $349.99 stays 34999 through every sum. Formatting and parsing go through Intl, which
 * knows each currency's decimals (JPY has none).
 */

/** Currencies offered for pre-orders (US first; collectors also buy from Europe, the UK, Japan…). */
export const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'ILS'] as const;
export type Currency = (typeof CURRENCIES)[number];

/** An amount with its currency: a figure's original price. */
export type Money = { amount: number; currency: Currency };

/** How many decimals a currency's amounts have: 2 for USD, 0 for JPY. */
export function currencyDigits(currency: Currency): number {
  return (
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits ?? 2
  );
}

/** "$349.99", "¥42,000", "₪1,250.00". */
export function formatMoney(minor: number, currency: Currency, locale = 'en-US'): string {
  const digits = currencyDigits(currency);
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(
    minor / 10 ** digits,
  );
}

/**
 * What someone typed ("350", "349.99", "1,250", "$40") → minor units, or null if it isn't an
 * amount (including more decimals than the currency has: "349.999" is likely a typo). Exact:
 * the string is split, never multiplied as a float. Never negative.
 */
export function parseMoney(input: string, currency: Currency): number | null {
  const cleaned = input.replace(/[\s,]/g, '').replace(/^[^\d.]+/, '');
  if (!/^\d+(\.\d*)?$|^\.\d+$/.test(cleaned)) return null;
  const digits = currencyDigits(currency);
  const [whole = '0', fraction = ''] = cleaned.split('.');
  if (fraction.length > digits) return null;
  return Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, '0') || '0');
}

/** Minor units → what a form field shows ("349.99", "42000"): no symbol, no grouping. */
export function moneyInputValue(minor: number, currency: Currency): string {
  const digits = currencyDigits(currency);
  return digits === 0 ? String(minor) : (minor / 10 ** digits).toFixed(digits);
}
