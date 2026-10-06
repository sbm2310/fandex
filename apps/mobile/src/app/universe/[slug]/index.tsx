import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { CategorySections } from '@/components/category-sections';
import { EmptyState } from '@/components/empty-state';
import { PageTitle } from '@/components/page-title';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { categoryCountsLabel } from '@/components/universe-card';
import { CharacterChips } from '@/components/universe-links';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useUniverse } from '@/hooks/use-universes';

/** Characters shown before "Show all" (a universe can have two dozen). */
const CHARACTER_LIMIT = 10;

/** Everything you own from one universe, grouped by category, with its characters. */
export default function UniverseScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { universe, items, summary, isPending, isError } = useUniverse(slug);

  if (!universe) {
    return (
      <ThemedView style={styles.fill}>
        <PageTitle title="Not found" />
        <EmptyState
          title="Universe not found"
          message="Fandex doesn't know this universe."
          action={{ label: 'See your universes', href: '/universes' }}
        />
      </ThemedView>
    );
  }

  if (isPending) {
    return (
      <ThemedView style={styles.centered}>
        <PageTitle title={universe.name} />
        <ActivityIndicator accessibilityLabel="Loading" />
      </ThemedView>
    );
  }

  if (isError || !items || !summary) {
    return (
      <ThemedView style={styles.fill}>
        <PageTitle title={universe.name} />
        <EmptyState
          title={isError ? "Couldn't load your collection" : `Nothing from ${universe.name} yet`}
          message={
            isError
              ? 'Check your connection and try again.'
              : `Books and LEGO sets from ${universe.name} you add show up here.`
          }
          {...(!isError && { action: { label: 'Add something', href: '/add' } })}
        />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.fill}>
      <PageTitle title={universe.name} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.column}>
          <View style={styles.heading}>
            <ThemedText type="subtitle" accessibilityRole="header">
              {universe.name}
            </ThemedText>
            <ThemedText themeColor="textSecondary">{universe.description}</ThemedText>
            <ThemedText type="smallBold">{categoryCountsLabel(summary.categoryCounts)}</ThemedText>
          </View>

          {summary.characters.length > 0 && (
            <View style={styles.section}>
              <ThemedText type="smallBold" accessibilityRole="header">
                Characters
              </ThemedText>
              <CharacterChips
                // The characters you own the most items with first (stable sort keeps the
                // seed's order among equals).
                characters={[...summary.characters]
                  .sort((a, b) => b.itemCount - a.itemCount)
                  .map((character) => ({
                    universe: universe.slug,
                    character: character.slug,
                    itemCount: character.itemCount,
                  }))}
                limit={CHARACTER_LIMIT}
              />
            </View>
          )}

          <CategorySections items={items} />
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
  },
  column: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.four,
  },
  heading: {
    gap: Spacing.one,
  },
  section: {
    gap: Spacing.two,
  },
});
