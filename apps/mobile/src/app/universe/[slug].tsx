import { CATEGORIES, type Category, type CollectionItem } from '@fandex/core';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { GRID_GAP, GridItem, useGridLayout } from '@/components/collection-grid';
import { EmptyState } from '@/components/empty-state';
import { PageTitle } from '@/components/page-title';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { categoryCountsLabel } from '@/components/universe-card';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUniverse } from '@/hooks/use-universes';

const SECTION_TITLES: Record<Category, string> = {
  book: 'Books',
  manga: 'Manga',
  comic: 'Comics',
  lego: 'LEGO',
};

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

          {summary.characters.length > 0 && <Characters characters={summary.characters} />}

          {CATEGORIES.map((category) => (
            <CategorySection
              key={category}
              category={category}
              items={items.filter((item) => item.category === category)}
            />
          ))}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function Characters({ characters }: { characters: { name: string; itemCount: number }[] }) {
  const colors = useTheme();
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" accessibilityRole="header">
        Characters
      </ThemedText>
      <View style={styles.chips}>
        {characters.map((character) => (
          <View
            key={character.name}
            accessible
            accessibilityLabel={`${character.name}, ${character.itemCount} ${character.itemCount === 1 ? 'item' : 'items'}`}
            style={[styles.chip, { borderColor: colors.border }]}
          >
            <ThemedText type="small">{character.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {character.itemCount}
            </ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

/** One category's items as a wrapping grid (a universe has dozens of items, not thousands). */
function CategorySection({ category, items }: { category: Category; items: CollectionItem[] }) {
  const { itemWidth } = useGridLayout();
  if (items.length === 0) return null;
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" accessibilityRole="header">
        {SECTION_TITLES[category]} · {items.length}
      </ThemedText>
      <View style={styles.grid}>
        {items.map((item) => (
          <GridItem key={item.id} item={item} width={itemWidth} />
        ))}
      </View>
    </View>
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    flexDirection: 'row',
    gap: Spacing.one,
    borderWidth: 1,
    borderRadius: Spacing.four,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
});
