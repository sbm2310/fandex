import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';

import { useTheme } from '@/hooks/use-theme';

type Props = {
  coverUrl?: string | undefined;
  title: string;
  width: number;
};

/** A book cover at a 2:3 ratio, with a lettered placeholder when there's no image (or it fails to load). */
export function BookCover({ coverUrl, title, width }: Props) {
  const colors = useTheme();
  const [failed, setFailed] = useState(false);
  const size = { width, height: Math.round(width * 1.5) };

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
      contentFit="cover"
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
