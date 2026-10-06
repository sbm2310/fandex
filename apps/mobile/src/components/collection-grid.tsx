import { formatTitle, type CollectionItem } from '@fandex/core';
import { Link } from 'expo-router';
import { FlatList, Pressable, StyleSheet, useWindowDimensions } from 'react-native';

import { BookCover } from './book-cover';
import { CategoryBadge, categoryForLabel } from './category-badge';
import { entryDetails } from './entry-row';
import { ThemedText } from './themed-text';

import { MaxContentWidth, Spacing } from '@/constants/theme';

const GAP = Spacing.three;
const MIN_ITEM_WIDTH = 96;
const MIN_COLUMNS = 3;

/** Grid gap between covers, for layouts that place GridItems themselves. */
export const GRID_GAP = GAP;

/** How many cover columns fit the screen (at least 3), and how wide each cover is. */
export function useGridLayout(): { columns: number; itemWidth: number } {
  const { width: windowWidth } = useWindowDimensions();
  const contentWidth = Math.min(windowWidth, MaxContentWidth) - Spacing.four * 2;
  const columns = Math.max(MIN_COLUMNS, Math.floor((contentWidth + GAP) / (MIN_ITEM_WIDTH + GAP)));
  return { columns, itemWidth: Math.floor((contentWidth - GAP * (columns - 1)) / columns) };
}

/** A grid of covers that fits as many columns as the screen allows (at least 3). */
export function CollectionGrid({ items }: { items: CollectionItem[] }) {
  const { columns, itemWidth } = useGridLayout();

  return (
    <FlatList
      // numColumns can't change on the fly; a new key remounts the list when it does.
      key={columns}
      data={items}
      numColumns={columns}
      keyExtractor={(item) => item.id}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.content}
      renderItem={({ item }) => <GridItem item={item} width={itemWidth} />}
      ListFooterComponent={
        <ThemedText type="small" themeColor="textSecondary" style={styles.attribution}>
          {items.some((item) => item.category === 'lego')
            ? 'Data and images from Open Library and Rebrickable'
            : 'Book data and covers from Open Library'}
        </ThemedText>
      }
    />
  );
}

/** The short line under a grid cover: first author, or "Set 75192". */
function gridSubtitle(item: CollectionItem): string | undefined {
  return item.category === 'lego' ? `Set ${item.catalog.setNumber}` : item.catalog.authors[0];
}

/** One cover with its title, linking to the item's detail screen. */
export function GridItem({ item, width }: { item: CollectionItem; width: number }) {
  const { title } = item.catalog;
  const [first] = entryDetails(item.catalog);
  const subtitle = gridSubtitle(item);
  const label = [
    formatTitle(item.catalog),
    categoryForLabel(item.category),
    first && (item.category === 'lego' ? `set ${first}` : `by ${first}`),
  ]
    .filter(Boolean)
    .join(', ');
  // Link asChild needs a single style object on its child (no arrays or style functions).
  return (
    <Link href={{ pathname: '/book/[id]', params: { id: item.id } }} asChild>
      <Pressable style={StyleSheet.flatten([styles.item, { width }])} accessibilityLabel={label}>
        <BookCover
          coverUrl={item.catalog.coverUrl}
          title={title}
          width={width}
          fit={item.category === 'lego' ? 'contain' : 'cover'}
        />
        <CategoryBadge category={item.category} />
        <ThemedText type="smallBold" numberOfLines={2}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {subtitle}
          </ThemedText>
        ) : null}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.four,
    paddingBottom: Spacing.four,
  },
  row: {
    gap: GAP,
  },
  item: {
    gap: Spacing.one,
  },
  attribution: {
    textAlign: 'center',
    paddingTop: Spacing.two,
  },
});
