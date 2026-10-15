import type { CatalogEntry } from '@fandex/core';
import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ItemArtwork } from './item-artwork';
import { ThemedText } from './themed-text';

import { Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useUniverseColors } from '@/hooks/use-universe-colors';

/**
 * The top of a universe or character page, on the universe's colour from edge to edge (the
 * navigation bar takes the same colour): optional artwork, the title, and whatever goes under it.
 */
export function UniverseHeader({
  universe,
  title,
  artwork = [],
  children,
}: {
  universe: string;
  title: string;
  artwork?: readonly CatalogEntry[];
  children?: ReactNode;
}) {
  const tint = useUniverseColors(universe);
  return (
    <View style={[styles.header, { backgroundColor: tint.ground }]}>
      <Stack.Screen
        options={{
          headerStyle: { backgroundColor: tint.ground },
          headerTintColor: tint.onGround,
          headerShadowVisible: false,
        }}
      />
      <View style={styles.column}>
        {artwork.length > 0 && (
          <View style={styles.artwork}>
            {artwork.map((entry) => (
              <ItemArtwork key={`${entry.source}:${entry.externalId}`} entry={entry} width={64} />
            ))}
          </View>
        )}
        <ThemedText
          type="subtitle"
          accessibilityRole="header"
          style={[styles.title, { color: tint.onGround }]}
        >
          {title}
        </ThemedText>
        {children}
      </View>
    </View>
  );
}

/** Text under the title, a little softer than the title (underlined when it's a link). */
export function HeaderText({
  universe,
  link = false,
  children,
}: {
  universe: string;
  link?: boolean;
  children: ReactNode;
}) {
  const tint = useUniverseColors(universe);
  return (
    <ThemedText style={[styles.soft, link && styles.link, { color: tint.onGround }]}>
      {children}
    </ThemedText>
  );
}

/**
 * Count tiles ("5 books", "2 LEGO sets", "1 on order"). Read out as one line by screen readers,
 * e.g. "5 books · 2 LEGO sets".
 */
export function CountTiles({
  universe,
  tiles,
  accessibilityLabel,
}: {
  universe: string;
  tiles: readonly { count: number; label: string }[];
  accessibilityLabel: string;
}) {
  const tint = useUniverseColors(universe);
  return (
    <View style={styles.tiles} accessible accessibilityLabel={accessibilityLabel}>
      {tiles.map((tile) => (
        <View key={tile.label} style={[styles.tile, { backgroundColor: tint.raised }]}>
          <ThemedText style={[styles.tileCount, { color: tint.onGround }]}>{tile.count}</ThemedText>
          <ThemedText type="small" style={[styles.tileLabel, { color: tint.onGround }]}>
            {tile.label}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
  },
  column: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.two,
  },
  artwork: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  title: {
    fontSize: 36,
    lineHeight: 40,
  },
  soft: {
    opacity: 0.85,
  },
  link: {
    fontFamily: Fonts.semiBold,
    textDecorationLine: 'underline',
  },
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  tile: {
    flexGrow: 1,
    flexBasis: '20%',
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: Spacing.two + Spacing.half,
    paddingHorizontal: Spacing.two,
  },
  tileCount: {
    fontFamily: Fonts.display,
    fontSize: 20,
    lineHeight: 24,
  },
  tileLabel: {
    fontSize: 11,
    lineHeight: 14,
    opacity: 0.85,
  },
});
