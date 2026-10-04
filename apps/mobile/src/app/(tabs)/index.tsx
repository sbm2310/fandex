import { sortCollection, type CollectionSort } from '@fandex/core';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { CollectionGrid } from '@/components/collection-grid';
import { EmptyState } from '@/components/empty-state';
import { PageTitle } from '@/components/page-title';
import { Screen } from '@/components/screen';
import { SortToggle } from '@/components/sort-toggle';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useCollection } from '@/hooks/use-collection';

export default function CollectionScreen() {
  const collection = useCollection();
  const [sort, setSort] = useState<CollectionSort>('recent');

  if (collection.isPending) {
    return (
      <Screen>
        <PageTitle title="My collection" />
        <View style={styles.centered}>
          <ActivityIndicator accessibilityLabel="Loading your collection" />
        </View>
      </Screen>
    );
  }

  if (collection.isError) {
    return (
      <Screen>
        <PageTitle title="My collection" />
        <EmptyState
          title="Couldn't load your collection"
          message="Your saved books couldn't be read. They haven't been deleted."
        />
      </Screen>
    );
  }

  if (collection.data.length === 0) {
    return (
      <Screen>
        <PageTitle title="My collection" />
        <EmptyState
          title="Your collection is empty"
          message="Add books by searching for a title or scanning an ISBN barcode."
          action={{ label: 'Add your first book', href: '/add' }}
        />
      </Screen>
    );
  }

  const count = collection.data.length;
  return (
    <Screen>
      <PageTitle title="My collection" />
      <View style={styles.header}>
        <ThemedText type="subtitle">My collection</ThemedText>
        <View style={styles.headerRow}>
          <ThemedText themeColor="textSecondary">
            {count} {count === 1 ? 'book' : 'books'}
          </ThemedText>
          <SortToggle value={sort} onChange={setSort} />
        </View>
      </View>
      <CollectionGrid items={sortCollection(collection.data, sort)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    gap: Spacing.one,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
});
