import type { Category } from '@fandex/core';

import { Pill } from './pill';

export const CATEGORY_LABELS: Record<Category, string> = {
  book: 'Book',
  manga: 'Manga',
  comic: 'Comic',
  lego: 'LEGO',
  figure: 'Figure',
};

/** True for categories worth a badge: books are the default, so they don't get one. */
function hasBadge(category: Category): boolean {
  return category !== 'book';
}

/** A small label for manga, comics, LEGO and figures. Renders nothing for plain books. */
export function CategoryBadge({ category }: { category: Category }) {
  if (!hasBadge(category)) return null;
  // Badges sit inside accessible rows/cards whose labels already include the category.
  return <Pill label={CATEGORY_LABELS[category]} />;
}

/** "manga" / "comic" etc. for accessibility labels; nothing for books. */
export function categoryForLabel(category: Category): string | undefined {
  return hasBadge(category) ? CATEGORY_LABELS[category].toLowerCase() : undefined;
}
