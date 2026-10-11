import type { ReleaseDate } from '@fandex/core';

/** YYYY-MM-DD ↔ a DATE column (midnight UTC). */
export const toDay = (value: string) => new Date(`${value}T00:00:00Z`);
export const fromDay = (value: Date) => value.toISOString().slice(0, 10);

/** A release date from its two columns; null unless both are set. */
export function releaseOf(
  date: Date | null,
  precision: ReleaseDate['precision'] | null,
): ReleaseDate | null {
  return date && precision ? { date: fromDay(date), precision } : null;
}

export const sameRelease = (a: ReleaseDate | null, b: ReleaseDate | null) =>
  a?.date === b?.date && a?.precision === b?.precision;
