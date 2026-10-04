/**
 * Collectible categories Fandex supports. Stage 1 is books only; manga, comics,
 * figures and LEGO are added as their catalog sources come online.
 */
export const CATEGORIES = ['book'] as const;

export type Category = (typeof CATEGORIES)[number];

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}
