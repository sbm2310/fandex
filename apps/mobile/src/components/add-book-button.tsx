import { formatTitle, type CatalogBook } from '@fandex/core';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';

import { Spacing } from '@/constants/theme';
import { useAddToCollection, useIsInCollection } from '@/hooks/use-collection';
import { useTheme } from '@/hooks/use-theme';

/** Adds a search result to the collection; each row tracks its own saving/saved/failed state. */
export function AddBookButton({ book }: { book: CatalogBook }) {
  const colors = useTheme();
  const inCollection = useIsInCollection(book);
  const add = useAddToCollection();
  const title = formatTitle(book);

  // Until we know whether it's owned, keep the space empty rather than flash "Add".
  if (inCollection === undefined) {
    return <View style={styles.slot} />;
  }

  if (inCollection) {
    return (
      <View style={styles.slot} accessible accessibilityLabel={`${title} is in your collection`}>
        <ThemedText type="smallBold" themeColor="accent">
          ✓ Owned
        </ThemedText>
      </View>
    );
  }

  if (add.isPending) {
    return (
      <View style={styles.slot}>
        <ActivityIndicator accessibilityLabel={`Adding ${title}`} color={colors.accent} />
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={add.isError ? `Couldn't add ${title}. Try again` : `Add ${title}`}
      onPress={() => add.mutate(book)}
      hitSlop={8}
      style={({ pressed }) => [
        styles.slot,
        styles.button,
        { backgroundColor: add.isError ? colors.backgroundSelected : colors.accent },
        pressed && styles.pressed,
      ]}
    >
      <ThemedText type="smallBold" themeColor={add.isError ? 'text' : 'onAccent'}>
        {add.isError ? 'Retry' : 'Add'}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  slot: {
    minWidth: 72,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    borderRadius: Spacing.four,
    paddingHorizontal: Spacing.three,
  },
  pressed: {
    opacity: 0.8,
  },
});
