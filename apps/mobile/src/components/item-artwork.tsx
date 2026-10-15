import type { CatalogEntry } from '@fandex/core';
import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';

import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUniverseColors } from '@/hooks/use-universe-colors';
import { initials } from '@/utils/initials';

type Props = {
  entry: CatalogEntry;
  width: number;
  /** Height ÷ width: 1.5 for a book or a grid tile (2:3), 1 for a square (sets and figures in rows). */
  aspectRatio?: number;
};

/** Below this width a tile has no room for its small print: just the number or the initial. */
const COMPACT_WIDTH = 80;

/**
 * An item's picture: its cover or product photo, else a tile drawn from its facts — a box-art
 * tile for figures, a title tile for books and sets. Tiles are decoration (the title is always
 * next to them), so they're hidden from screen readers.
 */
export function ItemArtwork({ entry, width, aspectRatio = 1.5 }: Props) {
  const [failed, setFailed] = useState(false);
  const size = { width, height: Math.round(width * aspectRatio) };

  if (!entry.coverUrl || failed) {
    return entry.category === 'figure' ? (
      <BoxArtTile entry={entry} size={size} />
    ) : (
      <TitleTile entry={entry} size={size} />
    );
  }
  // Sets and figures are product photos: shown whole rather than cropped like book covers.
  return (
    <CoverImage
      uri={entry.coverUrl}
      size={size}
      fit={entry.category === 'lego' || entry.category === 'figure' ? 'contain' : 'cover'}
      onError={() => setFailed(true)}
    />
  );
}

type Size = { width: number; height: number };

/** A cover image by URL (e.g. the cover stack on a universe card). */
export function CoverImage({
  uri,
  size,
  fit = 'cover',
  onError,
}: {
  uri: string;
  size: Size;
  /** "contain" shows the whole image (LEGO and figure photos); "cover" fills the frame (books). */
  fit?: 'cover' | 'contain';
  onError?: () => void;
}) {
  const colors = useTheme();
  return (
    <Image
      source={{ uri }}
      style={[styles.frame, size, { backgroundColor: colors.backgroundElement }]}
      contentFit={fit}
      transition={150}
      onError={onError}
      accessibilityIgnoresInvertColors
    />
  );
}

/** The parts of the tiles' type that grow with the tile. */
function scaled(width: number) {
  const clamp = (value: number, min: number, max: number) =>
    Math.round(Math.min(max, Math.max(min, value)));
  return {
    padding: clamp(width * 0.08, 5, 20),
    big: clamp(width * 0.22, 11, 54),
    initial: clamp(width * 0.42, 14, 54),
    title: clamp(width * 0.13, 11, 24),
    meta: clamp(width * 0.06, 8, 13),
    stripe: clamp(width * 0.026, 2, 6),
  };
}

/** "MMS 279" → ["MMS", "279"], so the code and the number get a line each. */
function numberLines(number: string): string {
  const space = number.lastIndexOf(' ');
  return space > 0 ? `${number.slice(0, space)}\n${number.slice(space + 1)}` : number;
}

const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
  'aria-hidden': true,
} as const;

/**
 * A figure without a photo, drawn like the front of its box: maker and scale on top, the box
 * number large in its universe's colour (or the name when it has no number), a stripe below.
 */
function BoxArtTile({ entry, size }: { entry: CatalogEntry & { category: 'figure' }; size: Size }) {
  const colors = useTheme();
  const universe = useUniverseColors(entry.universes?.[0]);
  const type = scaled(size.width);
  const compact = size.width < COMPACT_WIDTH;
  const headline = entry.number
    ? numberLines(entry.number)
    : compact
      ? initials(entry.title)
      : entry.title;

  return (
    <View
      testID="book-cover-placeholder"
      {...hidden}
      style={[
        styles.frame,
        styles.box,
        size,
        {
          padding: type.padding,
          backgroundColor: colors.backgroundElement,
          borderColor: colors.border,
        },
      ]}
    >
      {/* Small tiles keep an empty top row, so the number sits in the middle. */}
      {compact ? (
        <View />
      ) : (
        <View style={styles.boxTop}>
          <ThemedText
            numberOfLines={1}
            style={[styles.boxMaker, { fontSize: type.meta, lineHeight: type.meta * 1.3 }]}
            themeColor="textSecondary"
          >
            {entry.brand ?? 'Figure'}
          </ThemedText>
          {entry.scale ? (
            <ThemedText
              style={[styles.boxMaker, { fontSize: type.meta, lineHeight: type.meta * 1.3 }]}
              themeColor="textSecondary"
            >
              {entry.scale}
            </ThemedText>
          ) : null}
        </View>
      )}
      <View style={styles.boxMiddle}>
        <ThemedText
          numberOfLines={entry.number ? 2 : compact ? 1 : 4}
          adjustsFontSizeToFit
          style={[
            styles.display,
            {
              color: universe.accent,
              // The name is longer than a box number, so it's set smaller.
              fontSize: entry.number || compact ? type.big : type.title,
              lineHeight: (entry.number || compact ? type.big : type.title) * 0.95,
            },
          ]}
        >
          {headline}
        </ThemedText>
        {!compact && entry.line && size.width >= 160 ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
            {entry.line}
          </ThemedText>
        ) : null}
      </View>
      <View
        style={{
          height: type.stripe,
          borderRadius: type.stripe / 2,
          backgroundColor: universe.accent,
        }}
      />
    </View>
  );
}

/** A book or set without a cover: its title set large on its universe's tint. */
function TitleTile({ entry, size }: { entry: CatalogEntry; size: Size }) {
  const colors = useTheme();
  const universe = useUniverseColors(entry.universes?.[0]);
  const tinted = (entry.universes?.length ?? 0) > 0;
  const type = scaled(size.width);
  const compact = size.width < COMPACT_WIDTH;
  const meta =
    entry.category === 'lego'
      ? entry.setNumber
      : entry.category === 'figure'
        ? entry.brand
        : entry.authors[0];

  return (
    <View
      testID="book-cover-placeholder"
      {...hidden}
      style={[
        styles.frame,
        styles.titleTile,
        compact && styles.centered,
        size,
        {
          padding: type.padding,
          backgroundColor: tinted ? universe.ground : colors.backgroundSelected,
        },
      ]}
    >
      {compact ? (
        <ThemedText
          style={[styles.display, { fontSize: type.initial, lineHeight: type.initial * 1.2 }]}
          themeColor={tinted ? undefined : 'textSecondary'}
        >
          {entry.title.charAt(0).toUpperCase()}
        </ThemedText>
      ) : (
        <>
          {meta ? (
            <ThemedText
              numberOfLines={1}
              style={{ fontSize: type.meta, lineHeight: type.meta * 1.3 }}
              themeColor="textSecondary"
            >
              {meta}
            </ThemedText>
          ) : (
            <View />
          )}
          <ThemedText
            numberOfLines={Math.max(2, Math.floor(size.height / (type.title * 1.1)) - 2)}
            style={[
              styles.display,
              { color: universe.onGround, fontSize: type.title, lineHeight: type.title * 1.05 },
            ]}
          >
            {entry.title}
          </ThemedText>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: 6,
    overflow: 'hidden',
  },
  box: {
    borderWidth: 1,
    justifyContent: 'space-between',
  },
  boxTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  boxMaker: {
    fontFamily: Fonts.bold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  boxMiddle: {
    gap: 4,
  },
  display: {
    fontFamily: Fonts.display,
  },
  titleTile: {
    justifyContent: 'space-between',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
