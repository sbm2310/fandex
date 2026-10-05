import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';

import { useTheme } from '@/hooks/use-theme';

type Props = {
  coverUrl?: string | undefined;
  title: string;
  width: number;
  /** "contain" shows the whole image (LEGO box art); "cover" fills the frame (book covers). */
  fit?: 'cover' | 'contain';
  /** Height ÷ width: 1.5 for a book (2:3), 1 for a square frame (LEGO in lists). */
  aspectRatio?: number;
};

/** A book cover at a 2:3 ratio, with a lettered placeholder when there's no image (or it fails to load). */
export function BookCover({ coverUrl, title, width, fit = 'cover', aspectRatio = 1.5 }: Props) {
  const colors = useTheme();
  const [failed, setFailed] = useState(false);
  const size = { width, height: Math.round(width * aspectRatio) };

  if (!coverUrl || failed) {
    return (
      <View
        testID="book-cover-placeholder"
        style={[
          styles.cover,
          styles.placeholder,
          size,
          { backgroundColor: colors.backgroundSelected },
        ]}
      >
        <ThemedText type="smallBold" themeColor="textSecondary">
          {title.charAt(0).toUpperCase()}
        </ThemedText>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: coverUrl }}
      style={[styles.cover, size, { backgroundColor: colors.backgroundElement }]}
      contentFit={fit}
      transition={150}
      onError={() => setFailed(true)}
      accessibilityIgnoresInvertColors
    />
  );
}

const styles = StyleSheet.create({
  cover: {
    borderRadius: 4,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
