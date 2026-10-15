import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';

import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUniverseColors } from '@/hooks/use-universe-colors';
import { initials } from '@/utils/initials';

type Character = { slug: string; name: string; itemCount: number };

const SIZE = 58;

/**
 * A universe's characters as round avatars (initials ringed in the universe's accent, the item
 * count below), each opening the character's page. With `limit`, long lists show that many first,
 * with a "Show all" button for the rest.
 */
export function CharacterAvatars({
  universe,
  characters,
  limit,
}: {
  universe: string;
  characters: readonly Character[];
  limit?: number;
}) {
  const colors = useTheme();
  const tint = useUniverseColors(universe);
  const [expanded, setExpanded] = useState(false);
  const collapsible = limit !== undefined && characters.length > limit;
  const shown = collapsible && !expanded ? characters.slice(0, limit) : characters;

  return (
    <View style={styles.wrap}>
      <View style={styles.grid}>
        {shown.map((character) => {
          const items = `${character.itemCount} ${character.itemCount === 1 ? 'item' : 'items'}`;
          return (
            // Link asChild needs a single style object on its child (no arrays or style functions).
            <Link
              key={character.slug}
              href={{
                pathname: '/universe/[slug]/[character]',
                params: { slug: universe, character: character.slug },
              }}
              asChild
            >
              <Pressable accessibilityLabel={`${character.name}, ${items}`} style={styles.person}>
                <View
                  style={StyleSheet.flatten([
                    styles.avatar,
                    { backgroundColor: tint.ground, borderColor: tint.accent },
                  ])}
                >
                  <ThemedText style={[styles.initials, { color: tint.onGround }]}>
                    {initials(character.name)}
                  </ThemedText>
                </View>
                <ThemedText type="small" style={styles.name} numberOfLines={2}>
                  {character.name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.count}>
                  {items}
                </ThemedText>
              </Pressable>
            </Link>
          );
        })}
      </View>
      {collapsible && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            expanded ? 'Show fewer characters' : `Show all ${characters.length} characters`
          }
          onPress={() => setExpanded(!expanded)}
          style={[styles.more, { borderColor: colors.border }]}
        >
          <ThemedText type="small" themeColor="accent" style={styles.moreLabel}>
            {expanded ? 'Show fewer' : `Show all ${characters.length}`}
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.three,
    alignItems: 'flex-start',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Spacing.two,
    rowGap: Spacing.three,
  },
  person: {
    width: 68,
    alignItems: 'center',
    gap: Spacing.half,
  },
  avatar: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  initials: {
    fontFamily: Fonts.display,
    fontSize: 18,
    lineHeight: 22,
  },
  name: {
    fontFamily: Fonts.semiBold,
    fontSize: 12,
    lineHeight: 15,
    textAlign: 'center',
  },
  count: {
    fontSize: 11,
    lineHeight: 14,
  },
  more: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  moreLabel: {
    fontFamily: Fonts.semiBold,
  },
});
