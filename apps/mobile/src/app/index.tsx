import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { CollectionGrid } from '@/components/collection-grid';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useCollection } from '@/hooks/use-collection';

export default function CollectionScreen() {
  const collection = useCollection();

  if (collection.isPending) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator accessibilityLabel="Loading your collection" />
        </View>
      </Screen>
    );
  }

  if (collection.isError) {
    return (
      <Screen>
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
      <View style={styles.header}>
        <ThemedText type="subtitle">My collection</ThemedText>
        <ThemedText themeColor="textSecondary">
          {count} {count === 1 ? 'book' : 'books'}
        </ThemedText>
      </View>
      <CollectionGrid items={collection.data} />
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
    gap: Spacing.half,
  },
});
