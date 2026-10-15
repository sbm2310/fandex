import { sortCollection, type CollectionSort } from '@fandex/core';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import {
  CategoryFilter,
  countByCategory,
  countLabel,
  type CategoryFilterValue,
} from '@/components/category-filter';
import { CollectionGrid } from '@/components/collection-grid';
import { EmptyState } from '@/components/empty-state';
import { PageTitle } from '@/components/page-title';
import { SortToggle } from '@/components/sort-toggle';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useCollection } from '@/hooks/use-collection';

/** "Everything": the whole collection as a grid, with sorting and category filters. */
export default function EverythingScreen() {
  const collection = useCollection();
  const [sort, setSort] = useState<CollectionSort>('recent');
  const [filter, setFilter] = useState<CategoryFilterValue>('all');

  if (collection.isPending) {
    return (
      <ThemedView style={styles.centered}>
        <PageTitle title="Everything" />
        <ActivityIndicator accessibilityLabel="Loading your collection" />
      </ThemedView>
    );
  }

  if (collection.isError) {
    return (
      <ThemedView style={styles.fill}>
        <PageTitle title="Everything" />
        <EmptyState
          title="Couldn't load your collection"
          message={
            collection.mode === 'account'
              ? "Can't reach the Fandex server. Check your connection and try again."
              : "Your saved books couldn't be read. They haven't been deleted."
          }
        />
      </ThemedView>
    );
  }

  if (collection.data.length === 0) {
    return (
      <ThemedView style={styles.fill}>
        <PageTitle title="Everything" />
        <EmptyState
          title="Your collection is empty"
          message="Add books by searching for a title or scanning an ISBN barcode."
          action={{ label: 'Add your first book', href: '/add' }}
        />
      </ThemedView>
    );
  }

  // A filter for a category that's no longer in the collection falls back to "all".
  const owned = countByCategory(collection.data);
  const activeFilter = filter !== 'all' && owned.has(filter) ? filter : 'all';
  const visible =
    activeFilter === 'all'
      ? collection.data
      : collection.data.filter((item) => item.category === activeFilter);
  return (
    <ThemedView style={styles.fill}>
      <PageTitle title="Everything" />
      <View style={styles.column}>
        <View style={styles.header}>
          <ThemedText type="subtitle" accessibilityRole="header">
            Everything
          </ThemedText>
          <View style={styles.headerRow}>
            <ThemedText themeColor="textSecondary">
              {countLabel(collection.data, activeFilter)}
            </ThemedText>
            <SortToggle value={sort} onChange={setSort} />
          </View>
          <CategoryFilter items={collection.data} value={activeFilter} onChange={setFilter} />
        </View>
        <CollectionGrid items={sortCollection(visible, sort)} />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    alignItems: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    gap: Spacing.three,
  },
  header: {
    gap: Spacing.two,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
});
