import { findCharacter, findUniverse, type CharacterRef } from '@fandex/core';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';

import { Fonts, Spacing } from '@/constants/theme';
import { universeColors, type UniverseColors } from '@/constants/universe-colors';
import { useTheme, useThemeScheme } from '@/hooks/use-theme';

/** A rounded link chip, optionally with a count ("Gandalf 2"). */
function Chip({
  href,
  label,
  accessibilityLabel,
  count,
  tint,
}: {
  href: Parameters<typeof Link>[0]['href'];
  label: string;
  accessibilityLabel: string;
  count?: number | undefined;
  /** A universe chip wears its universe's colours; character chips stay neutral. */
  tint?: UniverseColors;
}) {
  const colors = useTheme();
  const look = tint
    ? { backgroundColor: tint.ground, borderColor: tint.ground, color: tint.onGround }
    : { backgroundColor: colors.backgroundElement, borderColor: colors.border, color: colors.text };
  return (
    // Link asChild needs a single style object on its child (no arrays or style functions).
    <Link href={href} asChild>
      <Pressable
        accessibilityLabel={accessibilityLabel}
        style={StyleSheet.flatten([
          styles.chip,
          { backgroundColor: look.backgroundColor, borderColor: look.borderColor },
        ])}
      >
        <ThemedText type="small" style={[styles.chipLabel, { color: look.color }]}>
          {label}
        </ThemedText>
        {count !== undefined && (
          <ThemedText type="small" themeColor="textSecondary">
            {count}
          </ThemedText>
        )}
      </Pressable>
    </Link>
  );
}

/** Links to universe pages ("Middle-earth"), for slugs the seed knows. */
export function UniverseChips({ universes }: { universes: readonly string[] }) {
  const scheme = useThemeScheme();
  const known = universes.flatMap((slug) => {
    const universe = findUniverse(slug);
    return universe ? [universe] : [];
  });
  if (known.length === 0) return null;
  return (
    <View style={styles.chips}>
      {known.map((universe) => (
        <Chip
          key={universe.slug}
          href={{ pathname: '/universe/[slug]', params: { slug: universe.slug } }}
          label={universe.name}
          accessibilityLabel={`${universe.name} universe`}
          tint={universeColors(universe.slug, scheme)}
        />
      ))}
    </View>
  );
}

/**
 * Links to character pages, optionally with how many of your items each is in. With `limit`,
 * long lists show that many first, with a "Show all" chip for the rest.
 */
export function CharacterChips({
  characters,
  limit,
}: {
  characters: readonly (CharacterRef & { itemCount?: number })[];
  limit?: number;
}) {
  const colors = useTheme();
  const [expanded, setExpanded] = useState(false);
  const known = characters.flatMap((ref) => {
    const character = findCharacter(ref.universe, ref.character);
    return character ? [{ ...ref, name: character.name }] : [];
  });
  if (known.length === 0) return null;
  const collapsible = limit !== undefined && known.length > limit;
  const shown = collapsible && !expanded ? known.slice(0, limit) : known;
  return (
    <View style={styles.chips}>
      {shown.map((character) => (
        <Chip
          key={`${character.universe}/${character.character}`}
          href={{
            pathname: '/universe/[slug]/[character]',
            params: { slug: character.universe, character: character.character },
          }}
          label={character.name}
          count={character.itemCount}
          accessibilityLabel={
            character.itemCount === undefined
              ? character.name
              : `${character.name}, ${character.itemCount} ${character.itemCount === 1 ? 'item' : 'items'}`
          }
        />
      ))}
      {collapsible && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            expanded ? 'Show fewer characters' : `Show all ${known.length} characters`
          }
          onPress={() => setExpanded(!expanded)}
          style={[styles.chip, { borderColor: colors.accent }]}
        >
          <ThemedText type="small" themeColor="accent">
            {expanded ? 'Show fewer' : `Show all ${known.length}`}
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
    paddingVertical: Spacing.one + Spacing.half,
    paddingHorizontal: Spacing.three,
  },
  chipLabel: {
    fontFamily: Fonts.semiBold,
  },
});
