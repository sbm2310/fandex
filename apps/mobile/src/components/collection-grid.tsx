import { formatTitle, type CollectionItem } from '@fandex/core';
import { Link } from 'expo-router';
import { FlatList, Pressable, StyleSheet, useWindowDimensions } from 'react-native';

import { BookCover } from './book-cover';
import { CategoryBadge, categoryForLabel } from './category-badge';
import { ThemedText } from './themed-text';

import { MaxContentWidth, Spacing } from '@/constants/theme';

const GAP = Spacing.three;
const MIN_ITEM_WIDTH = 96;
const MIN_COLUMNS = 3;

/** A grid of covers that fits as many columns as the screen allows (at least 3). */
export function CollectionGrid({ items }: { items: CollectionItem[] }) {
  const { width: windowWidth } = useWindowDimensions();
  const contentWidth = Math.min(windowWidth, MaxContentWidth) - Spacing.four * 2;
  const columns = Math.max(MIN_COLUMNS, Math.floor((contentWidth + GAP) / (MIN_ITEM_WIDTH + GAP)));
  const itemWidth = Math.floor((contentWidth - GAP * (columns - 1)) / columns);

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
          Book data and covers from Open Library
        </ThemedText>
      }
    />
  );
}

function GridItem({ item, width }: { item: CollectionItem; width: number }) {
  const { title, authors } = item.catalog;
  // Link asChild needs a single style object on its child (no arrays or style functions).
  return (
    <Link href={{ pathname: '/book/[id]', params: { id: item.id } }} asChild>
      <Pressable
        style={StyleSheet.flatten([styles.item, { width }])}
        accessibilityLabel={[
          formatTitle(item.catalog),
          categoryForLabel(item.category),
          authors.length > 0 && `by ${authors.join(', ')}`,
        ]
          .filter(Boolean)
          .join(', ')}
      >
        <BookCover coverUrl={item.catalog.coverUrl} title={title} width={width} />
        <CategoryBadge category={item.category} />
        <ThemedText type="smallBold" numberOfLines={2}>
          {title}
        </ThemedText>
        {authors.length > 0 && (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {authors[0]}
          </ThemedText>
        )}
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
