import { CATEGORIES } from '@fandex/core';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { CategorySections } from '@/components/category-sections';
import { EmptyState } from '@/components/empty-state';
import { PageTitle } from '@/components/page-title';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CharacterAvatars } from '@/components/character-avatars';
import { categoryCountsLabel, NOUNS } from '@/components/universe-card';
import { CountTiles, HeaderText, UniverseHeader } from '@/components/universe-header';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { usePreorders } from '@/hooks/use-preorders';
import { newestFrom, useUniverse } from '@/hooks/use-universes';

/** Characters shown before "Show all" (a universe can have two dozen). */
const CHARACTER_LIMIT = 10;

/** Newest items shown at the top of the header. */
const HEADER_ARTWORK = 4;

/** Everything you own from one universe, grouped by category, with its characters. */
export default function UniverseScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { universe, items, summary, isPending, isError } = useUniverse(slug);
  const preorders = usePreorders();

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

  const onOrder = (preorders.data ?? []).filter(
    (preorder) =>
      preorder.status === 'ordered' && preorder.catalog.universes.includes(universe.slug),
  ).length;
  const tiles = [
    ...CATEGORIES.flatMap((category) => {
      const count = summary.categoryCounts[category];
      if (!count) return [];
      const [singular, plural] = NOUNS[category];
      return [{ count, label: count === 1 ? singular : plural }];
    }),
    ...(onOrder > 0 ? [{ count: onOrder, label: 'on order' }] : []),
  ];
  const countsLabel = [
    categoryCountsLabel(summary.categoryCounts),
    ...(onOrder > 0 ? [`${onOrder} on order`] : []),
  ].join(' · ');

  return (
    <ThemedView style={styles.fill}>
      <PageTitle title={universe.name} />
      <ScrollView contentContainerStyle={styles.content}>
        <UniverseHeader
          universe={universe.slug}
          title={universe.name}
          artwork={newestFrom(items, universe.slug, HEADER_ARTWORK)}
        >
          <HeaderText universe={universe.slug}>{universe.description}</HeaderText>
          <CountTiles universe={universe.slug} tiles={tiles} accessibilityLabel={countsLabel} />
        </UniverseHeader>

        <View style={styles.body}>
          <View style={styles.column}>
            {summary.characters.length > 0 && (
              <View style={styles.section}>
                <ThemedText type="section" accessibilityRole="header">
                  Characters
                </ThemedText>
                <CharacterAvatars
                  universe={universe.slug}
                  // The characters you own the most items with first (stable sort keeps the
                  // seed's order among equals).
                  characters={[...summary.characters].sort((a, b) => b.itemCount - a.itemCount)}
                  limit={CHARACTER_LIMIT}
                />
              </View>
            )}

            <CategorySections items={items} />
          </View>
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
    paddingBottom: Spacing.four,
  },
  body: {
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
  },
  column: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.four,
  },
  section: {
    gap: Spacing.two,
  },
});
