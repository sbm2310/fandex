import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { PageTitle } from '@/components/page-title';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { UniverseCard } from '@/components/universe-card';
import { Spacing } from '@/constants/theme';
import { useCollectionUniverses } from '@/hooks/use-universes';

/** Your collection by universe: everything from Middle-earth, Star Wars… across formats. */
export default function UniversesScreen() {
  const { universes, isPending, isError, mode } = useCollectionUniverses();

  if (isPending) {
    return (
      <Screen>
        <PageTitle title="Universes" />
        <View style={styles.centered}>
          <ActivityIndicator accessibilityLabel="Loading your universes" />
        </View>
      </Screen>
    );
  }

  if (isError || !universes) {
    return (
      <Screen>
        <PageTitle title="Universes" />
        <EmptyState
          title="Couldn't load your collection"
          message={
            mode === 'account'
              ? "Can't reach the Fandex server. Check your connection and try again."
              : "Your saved items couldn't be read. They haven't been deleted."
          }
        />
      </Screen>
    );
  }

  if (universes.length === 0) {
    return (
      <Screen>
        <PageTitle title="Universes" />
        <EmptyState
          title="No universes yet"
          message="Books and LEGO sets from Middle-earth, Star Wars, the Wizarding World, DC and Marvel are grouped here, across formats."
          action={{ label: 'Add something', href: '/add' }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <PageTitle title="Universes" />
      <View style={styles.header}>
        <ThemedText type="subtitle">Universes</ThemedText>
        <ThemedText themeColor="textSecondary">
          {universes.length === 1 ? '1 universe' : `${universes.length} universes`}
        </ThemedText>
      </View>
      <FlatList
        data={universes}
        keyExtractor={(universe) => universe.slug}
        renderItem={({ item }) => <UniverseCard universe={item} />}
        contentContainerStyle={styles.list}
      />
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
  list: {
    gap: Spacing.three,
    paddingBottom: Spacing.four,
  },
});
