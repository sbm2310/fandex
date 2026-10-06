import { CATEGORIES, type Category, type CollectionItem } from '@fandex/core';
import { StyleSheet, View } from 'react-native';

import { GRID_GAP, GridItem, useGridLayout } from './collection-grid';
import { ThemedText } from './themed-text';

import { Spacing } from '@/constants/theme';

const SECTION_TITLES: Record<Category, string> = {
  book: 'Books',
  manga: 'Manga',
  comic: 'Comics',
  lego: 'LEGO',
};

/**
 * Items grouped by category (Books, Manga, Comics, LEGO), each group a wrapping grid of
 * covers. For a universe's or character's items: dozens, not thousands, so no virtualization.
 */
export function CategorySections({ items }: { items: readonly CollectionItem[] }) {
  const { itemWidth } = useGridLayout();
  return CATEGORIES.map((category) => {
    const inCategory = items.filter((item) => item.category === category);
    if (inCategory.length === 0) return null;
    return (
      <View key={category} style={styles.section}>
        <ThemedText type="smallBold" accessibilityRole="header">
          {SECTION_TITLES[category]} · {inCategory.length}
        </ThemedText>
        <View style={styles.grid}>
          {inCategory.map((item) => (
            <GridItem key={item.id} item={item} width={itemWidth} />
          ))}
        </View>
      </View>
    );
  });
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
});
