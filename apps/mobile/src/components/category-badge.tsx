import type { Category } from '@fandex/core';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export const CATEGORY_LABELS: Record<Category, string> = {
  book: 'Book',
  manga: 'Manga',
  comic: 'Comic',
  lego: 'LEGO',
};

/** True for categories worth a badge: books are the default, so they don't get one. */
export function hasBadge(category: Category): boolean {
  return category !== 'book';
}

/** A small label for manga, comics and LEGO. Renders nothing for plain books. */
export function CategoryBadge({ category }: { category: Category }) {
  const colors = useTheme();
  if (!hasBadge(category)) return null;
  return (
    // Badges sit inside accessible rows/cards whose labels already include the category.
    <View style={[styles.badge, { borderColor: colors.accent }]}>
      <ThemedText style={[styles.text, { color: colors.accent }]}>
        {CATEGORY_LABELS[category]}
      </ThemedText>
    </View>
  );
}

/** "manga" / "comic" etc. for accessibility labels; nothing for books. */
export function categoryForLabel(category: Category): string | undefined {
  return hasBadge(category) ? CATEGORY_LABELS[category].toLowerCase() : undefined;
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: Spacing.one,
    paddingHorizontal: Spacing.one + Spacing.half,
    paddingVertical: Spacing.half,
  },
  text: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
