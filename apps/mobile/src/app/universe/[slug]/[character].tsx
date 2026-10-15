import { Link, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { countByCategory } from '@/components/category-filter';
import { CategorySections } from '@/components/category-sections';
import { EmptyState } from '@/components/empty-state';
import { PageTitle } from '@/components/page-title';
import { ThemedView } from '@/components/themed-view';
import { categoryCountsLabel } from '@/components/universe-card';
import { HeaderText, UniverseHeader } from '@/components/universe-header';
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
        <UniverseHeader universe={universe.slug} title={character.name}>
          <Link href={{ pathname: '/universe/[slug]', params: { slug: universe.slug } }}>
            <HeaderText universe={universe.slug} link>
              {universe.name}
            </HeaderText>
          </Link>
          <HeaderText universe={universe.slug}>
            {categoryCountsLabel(Object.fromEntries(countByCategory(items)))}
          </HeaderText>
        </UniverseHeader>
        <View style={styles.body}>
          <View style={styles.column}>
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
});
