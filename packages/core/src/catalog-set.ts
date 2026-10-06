import type { MatchSignals } from './universes/match-signals';
import type { CharacterRef } from './universes/match-universes';

/** A LEGO set as Rebrickable describes it. */
export type CatalogSet = {
  source: 'rebrickable';
  /** Rebrickable's set number including the version suffix, e.g. "75192-1". */
  externalId: string;
  category: 'lego';
  /** Our own catalog id, when the entry came through the Fandex API. */
  catalogId?: string;
  title: string;
  /** The set number as printed on the box: "75192" (the "-1" suffix dropped for version 1). */
  setNumber: string;
  year?: number;
  pieceCount?: number;
  /** Top-level theme, e.g. "Star Wars" (a natural "universe" for the Stage 3 universe layer). */
  theme?: string;
  /** Sub-theme, e.g. "Ultimate Collector Series". */
  subtheme?: string;
  coverUrl?: string;
  /** Set by catalog adapters for universe matching; the API keeps it server-side. */
  matchSignals?: MatchSignals;
  /** Universes this entry belongs to (slugs), as the Fandex API matched them. */
  universes?: string[];
  /** Characters in it, each with its universe. */
  characters?: CharacterRef[];
};

/** "75192-1" → "75192"; other versions keep their suffix ("10179-2"). */
export function displaySetNumber(setNum: string): string {
  return setNum.replace(/-1$/, '');
}

/**
 * Normalizes a typed set number to Rebrickable's form: "75192" → "75192-1". Returns null for
 * input that can't be a set number.
 */
export function parseSetNumber(input: string): string | null {
  const value = input.trim();
  if (!/^[A-Za-z0-9]{2,20}(-\d{1,3})?$/.test(value)) return null;
  return value.includes('-') ? value : `${value}-1`;
}
