import { sortCollection, type CollectionSort } from '@fandex/core';
import { Link } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import {
  CategoryFilter,
  countByCategory,
  countLabel,
  type CategoryFilterValue,
} from '@/components/category-filter';
import { CollectionGrid } from '@/components/collection-grid';
import { EmptyState } from '@/components/empty-state';
import { MoveToAccountBanner } from '@/components/move-to-account-banner';
import { PageTitle } from '@/components/page-title';
import { Screen } from '@/components/screen';
import { SortToggle } from '@/components/sort-toggle';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useCollection, useDeviceCollection } from '@/hooks/use-collection';
import { useTheme } from '@/hooks/use-theme';

export default function CollectionScreen() {
  const collection = useCollection();
  // Signed in: also read this device's books (local, fast) to offer moving them to the account.
  const device = useDeviceCollection({ enabled: collection.mode === 'account' });
  const deviceCount = device.data?.length ?? 0;
  const banner = collection.mode === 'account' && <MoveToAccountBanner deviceCount={deviceCount} />;
  const [sort, setSort] = useState<CollectionSort>('recent');
  const [filter, setFilter] = useState<CategoryFilterValue>('all');

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

  // A filter for a category that's no longer in the collection falls back to "all".
  const owned = countByCategory(collection.data);
  const activeFilter = filter !== 'all' && owned.has(filter) ? filter : 'all';
  const visible =
    activeFilter === 'all'
      ? collection.data
      : collection.data.filter((item) => item.category === activeFilter);
  return (
    <Screen>
      <PageTitle title="My collection" />
      {banner}
      <View style={styles.header}>
        <ThemedText type="subtitle">My collection</ThemedText>
        <View style={styles.headerRow}>
          <ThemedText themeColor="textSecondary">
            {countLabel(collection.data, activeFilter)}
          </ThemedText>
          <SortToggle value={sort} onChange={setSort} />
        </View>
        <AskLink />
        <CategoryFilter items={collection.data} value={activeFilter} onChange={setFilter} />
      </View>
      <CollectionGrid items={sortCollection(visible, sort)} />
    </Screen>
  );
}

/** Opens "Ask your collection" (looks like a search field; questions are typed there). */
function AskLink() {
  const colors = useTheme();
  // Link asChild needs a single style object on its child (no arrays or style functions).
  return (
    <Link href="/ask" asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Ask your collection, for example: What Batman stuff do I own?"
        style={StyleSheet.flatten([styles.ask, { backgroundColor: colors.backgroundElement }])}
      >
        <SymbolView
          name={{ ios: 'sparkle.magnifyingglass', android: 'manage_search', web: 'manage_search' }}
          tintColor={colors.textSecondary}
          size={20}
        />
        <ThemedText themeColor="textSecondary">Ask your collection…</ThemedText>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  ask: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    marginVertical: Spacing.two,
  },
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
