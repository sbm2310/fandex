import { CATEGORIES, type Category, type CollectionUniverse } from '@fandex/core';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ItemArtwork } from './item-artwork';
import { ThemedText } from './themed-text';

import { Spacing } from '@/constants/theme';
import type { UniverseColors } from '@/constants/universe-colors';
import type { UniverseOverview } from '@/hooks/use-universes';
import { useUniverseColors } from '@/hooks/use-universe-colors';

export const NOUNS: Record<Category, [string, string]> = {
  book: ['book', 'books'],
  manga: ['manga', 'manga'],
  comic: ['comic', 'comics'],
  lego: ['LEGO set', 'LEGO sets'],
  figure: ['figure', 'figures'],
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

/**
 * A universe in its colours: newest artwork, counts and characters. Full width on the Universes
 * tab; `compact` is the narrower, taller card for the home screen's sideways row.
 */
export function UniverseCard({
  universe,
  compact = false,
}: {
  universe: UniverseOverview;
  compact?: boolean;
}) {
  const tint = useUniverseColors(universe.slug);
  const counts = categoryCountsLabel(universe.categoryCounts);
  const characters = charactersLabel(universe.characters);
  const owned = universe.characters.length;
  const total = universe.characterTotal;

  return (
    // Link asChild needs a single style object on its child (no arrays or style functions).
    <Link href={{ pathname: '/universe/[slug]', params: { slug: universe.slug } }} asChild>
      <Pressable
        accessibilityLabel={[universe.name, counts, characters].filter(Boolean).join(', ')}
        style={StyleSheet.flatten([
          styles.card,
          compact && styles.compactCard,
          { backgroundColor: tint.ground },
        ])}
      >
        {compact && (
          <View style={styles.artwork}>
            {universe.artwork.map((entry) => (
              <ItemArtwork key={`${entry.source}:${entry.externalId}`} entry={entry} width={40} />
            ))}
          </View>
        )}
        <View style={[styles.text, compact && styles.compactText]}>
          <ThemedText
            type="section"
            style={[{ color: tint.onGround }, compact && styles.compactName]}
            // On the narrow home card a long name shrinks rather than breaking at its hyphen
            // (iOS; the smaller size is what keeps "Middle-earth" whole on the web).
            numberOfLines={compact ? 1 : undefined}
            adjustsFontSizeToFit={compact}
          >
            {universe.name}
          </ThemedText>
          <ThemedText
            type="small"
            style={[styles.soft, { color: tint.onGround }]}
            numberOfLines={compact ? 1 : undefined}
          >
            {compact ? itemsLabel(universe.itemCount) : counts}
          </ThemedText>
          {total > 0 ? (
            <View style={styles.progress}>
              <ThemedText type="small" style={[styles.soft, { color: tint.onGround }]}>
                {owned} of {total} characters
              </ThemedText>
              <ProgressBar value={owned / total} tint={tint} />
            </View>
          ) : null}
        </View>
        {!compact && (
          <View style={styles.artwork}>
            {universe.artwork.map((entry) => (
              <ItemArtwork key={`${entry.source}:${entry.externalId}`} entry={entry} width={46} />
            ))}
          </View>
        )}
      </Pressable>
    </Link>
  );
}

/** A thin bar in the universe's accent, filled to `value` (0–1). */
export function ProgressBar({ value, tint }: { value: number; tint: UniverseColors }) {
  return (
    <View style={[styles.track, { backgroundColor: tint.raised }]}>
      <View
        style={[
          styles.fill,
          {
            width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`,
            backgroundColor: tint.accent,
          },
        ]}
      />
    </View>
  );
}

const itemsLabel = (count: number) => (count === 1 ? '1 item' : `${count} items`);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 18,
  },
  compactCard: {
    width: 168,
    minHeight: 196,
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    borderRadius: 18,
  },
  text: {
    flex: 1,
    gap: Spacing.half,
  },
  compactName: {
    fontSize: 18,
    lineHeight: 23,
  },
  // Not `flex: 0`: on the web that's a zero height, hiding the text.
  compactText: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
  },
  soft: {
    opacity: 0.85,
  },
  progress: {
    gap: Spacing.one,
    paddingTop: Spacing.one,
  },
  track: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: 4,
    borderRadius: 2,
  },
  artwork: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.one,
  },
});
