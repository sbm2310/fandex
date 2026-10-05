import { CATEGORIES, type Category, type CollectionItem } from '@fandex/core';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from './themed-text';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type CategoryFilterValue = Category | 'all';

const PLURAL_LABELS: Record<Category, string> = {
  book: 'Books',
  manga: 'Manga',
  comic: 'Comics',
  lego: 'LEGO',
};

/** How many items of each category the collection has (only categories present). */
export function countByCategory(items: readonly CollectionItem[]): Map<Category, number> {
  const counts = new Map<Category, number>();
  for (const category of CATEGORIES) {
    const count = items.filter((item) => item.category === category).length;
    if (count > 0) counts.set(category, count);
  }
  return counts;
}

const NOUNS: Record<Category | 'all', [string, string]> = {
  book: ['book', 'books'],
  manga: ['manga', 'manga'],
  comic: ['comic', 'comics'],
  lego: ['set', 'sets'],
  all: ['item', 'items'],
};

/** "8 books", "1 set", "12 items"… for the filtered list (all books still read as "books"). */
export function countLabel(items: readonly CollectionItem[], filter: CategoryFilterValue): string {
  const counts = countByCategory(items);
  const only = counts.size === 1 ? [...counts.keys()][0] : undefined;
  const noun = filter === 'all' ? (only ?? 'all') : filter;
  const count = filter === 'all' ? items.length : (counts.get(filter) ?? 0);
  const [singular, plural] = NOUNS[noun];
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * Chips to filter the collection by category. Only categories the user owns appear, and the
 * whole row is hidden when there's just one.
 */
export function CategoryFilter({
  items,
  value,
  onChange,
}: {
  items: readonly CollectionItem[];
  value: CategoryFilterValue;
  onChange: (value: CategoryFilterValue) => void;
}) {
  const colors = useTheme();
  const counts = countByCategory(items);
  if (counts.size < 2) return null;

  const options: { value: CategoryFilterValue; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: items.length },
    ...[...counts].map(([category, count]) => ({
      value: category,
      label: PLURAL_LABELS[category],
      count,
    })),
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="radiogroup"
      accessibilityLabel="Show"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={`${option.label}, ${option.count}`}
            onPress={() => onChange(option.value)}
            style={[
              styles.chip,
              { borderColor: selected ? colors.accent : colors.border },
              selected && { backgroundColor: colors.accent },
            ]}
          >
            <ThemedText type="small" style={{ color: selected ? colors.onAccent : colors.text }}>
              {option.label} {option.count}
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: Spacing.two,
  },
  chip: {
    borderWidth: 1,
    borderRadius: Spacing.four,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
});
