import { Link, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { countByCategory } from '@/components/category-filter';
import { CategorySections } from '@/components/category-sections';
import { EmptyState } from '@/components/empty-state';
import { PageTitle } from '@/components/page-title';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { categoryCountsLabel } from '@/components/universe-card';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useCharacter } from '@/hooks/use-universes';

/** Everything you own with one character in it (books they appear in, sets with their minifig). */
export default function CharacterScreen() {
  const params = useLocalSearchParams<{ slug: string; character: string }>();
  const { universe, character, items, isPending, isError } = useCharacter(
    params.slug,
    params.character,
  );

  if (!universe || !character) {
    return (
      <ThemedView style={styles.fill}>
        <PageTitle title="Not found" />
        <EmptyState
          title="Character not found"
          message="Fandex doesn't know this character."
          action={{ label: 'See your universes', href: '/universes' }}
        />
      </ThemedView>
    );
  }

  if (isPending) {
    return (
      <ThemedView style={styles.centered}>
        <PageTitle title={character.name} />
        <ActivityIndicator accessibilityLabel="Loading" />
      </ThemedView>
    );
  }

  if (isError || !items || items.length === 0) {
    return (
      <ThemedView style={styles.fill}>
        <PageTitle title={character.name} />
        <EmptyState
          title={isError ? "Couldn't load your collection" : `Nothing with ${character.name} yet`}
          message={
            isError
              ? 'Check your connection and try again.'
              : `Books ${character.name} appears in, and LEGO sets with their minifig, show up here.`
          }
          {...(!isError && { action: { label: 'Add something', href: '/add' } })}
        />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.fill}>
      <PageTitle title={character.name} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.column}>
          <View style={styles.heading}>
            <ThemedText type="subtitle" accessibilityRole="header">
              {character.name}
            </ThemedText>
            <Link href={{ pathname: '/universe/[slug]', params: { slug: universe.slug } }}>
              <ThemedText themeColor="accent">{universe.name}</ThemedText>
            </Link>
            <ThemedText type="smallBold">
              {categoryCountsLabel(Object.fromEntries(countByCategory(items)))}
            </ThemedText>
          </View>
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
    alignItems: 'flex-start',
  },
});
