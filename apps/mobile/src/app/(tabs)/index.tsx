import { sortCollection, type CollectionSort } from '@fandex/core';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { CollectionGrid } from '@/components/collection-grid';
import { EmptyState } from '@/components/empty-state';
import { MoveToAccountBanner } from '@/components/move-to-account-banner';
import { PageTitle } from '@/components/page-title';
import { Screen } from '@/components/screen';
import { SortToggle } from '@/components/sort-toggle';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useCollection, useDeviceCollection } from '@/hooks/use-collection';

export default function CollectionScreen() {
  const collection = useCollection();
  // Signed in: also read this device's books (local, fast) to offer moving them to the account.
  const device = useDeviceCollection({ enabled: collection.mode === 'account' });
  const deviceCount = device.data?.length ?? 0;
  const banner = collection.mode === 'account' && <MoveToAccountBanner deviceCount={deviceCount} />;
  const [sort, setSort] = useState<CollectionSort>('recent');

  if (collection.isPending || (collection.mode === 'account' && device.isPending)) {
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
          message={
            collection.mode === 'account'
              ? "Can't reach the Fandex server. Check your connection and try again."
              : "Your saved books couldn't be read. They haven't been deleted."
          }
        />
      </Screen>
    );
  }

  if (collection.data.length === 0) {
    return (
      <Screen>
        <PageTitle title="My collection" />
        {banner}
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
      {banner}
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
