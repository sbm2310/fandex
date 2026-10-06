import { CATEGORIES, type Category, type CollectionUniverse } from '@fandex/core';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { BookCover } from './book-cover';
import { ThemedText } from './themed-text';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const NOUNS: Record<Category, [string, string]> = {
  book: ['book', 'books'],
  manga: ['manga', 'manga'],
  comic: ['comic', 'comics'],
  lego: ['LEGO set', 'LEGO sets'],
};

/** "2 books · 1 LEGO set", in category order. */
export function categoryCountsLabel(counts: CollectionUniverse['categoryCounts']): string {
  return CATEGORIES.flatMap((category) => {
    const count = counts[category];
    if (!count) return [];
    const [singular, plural] = NOUNS[category];
    return [`${count} ${count === 1 ? singular : plural}`];
  }).join(' · ');
}

/** "Gandalf, Bilbo Baggins and 3 more" — the characters you own the most items with first. */
export function charactersLabel(
  characters: CollectionUniverse['characters'],
  shown = 2,
): string | undefined {
  if (characters.length === 0) return undefined;
  const names = [...characters]
    .sort((a, b) => b.itemCount - a.itemCount)
    .slice(0, shown)
    .map((character) => character.name);
  const more = characters.length - names.length;
  return more > 0 ? `${names.join(', ')} and ${more} more` : names.join(' and ');
}

const COVER_WIDTH = 44;

/** A universe on the Universes tab: covers, name, counts and main characters. */
export function UniverseCard({ universe }: { universe: CollectionUniverse }) {
  const colors = useTheme();
  const counts = categoryCountsLabel(universe.categoryCounts);
  const characters = charactersLabel(universe.characters);

  return (
    // Link asChild needs a single style object on its child (no arrays or style functions).
    <Link href={{ pathname: '/universe/[slug]', params: { slug: universe.slug } }} asChild>
      <Pressable
        accessibilityLabel={[universe.name, counts, characters].filter(Boolean).join(', ')}
        style={StyleSheet.flatten([styles.card, { backgroundColor: colors.backgroundElement }])}
      >
        <View style={styles.covers}>
          {universe.coverUrls.slice(0, 3).map((coverUrl) => (
            <BookCover
              key={coverUrl}
              coverUrl={coverUrl}
              title={universe.name}
              width={COVER_WIDTH}
              fit="contain"
            />
          ))}
        </View>
        <View style={styles.text}>
          <ThemedText type="smallBold">{universe.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {counts}
          </ThemedText>
          {characters ? (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
              {characters}
            </ThemedText>
          ) : null}
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  covers: {
    flexDirection: 'row',
    gap: Spacing.one,
    width: COVER_WIDTH * 3 + Spacing.one * 2,
  },
  text: {
    flex: 1,
    gap: Spacing.half,
  },
});
