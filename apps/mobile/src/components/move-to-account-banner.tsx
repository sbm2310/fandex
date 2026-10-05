import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from './button';
import { ThemedText } from './themed-text';

import { Spacing } from '@/constants/theme';
import { useMoveToAccount } from '@/hooks/use-move-to-account';
import { useTheme } from '@/hooks/use-theme';

const books = (count: number) => `${count} ${count === 1 ? 'book' : 'books'}`;

/**
 * Shown while signed in if books are still saved only on this device (added before signing in):
 * offers to move them into the account so they sync. The screen passes the count once it has
 * read the device collection, so the banner never pops in after the grid (no layout shift).
 */
export function MoveToAccountBanner({ deviceCount: count }: { deviceCount: number }) {
  const colors = useTheme();
  const [dismissed, setDismissed] = useState(false);
  const move = useMoveToAccount();

  if (move.data) {
    const { moved, failed } = move.data;
    return (
      <View
        style={[styles.banner, { backgroundColor: colors.backgroundElement }]}
        accessibilityRole="alert"
      >
        <ThemedText type="small">
          {failed === 0
            ? `Moved ${books(moved)} to your account.`
            : `Moved ${books(moved)} to your account. ${books(failed)} couldn't be matched to the catalog and stay on this device.`}
        </ThemedText>
      </View>
    );
  }

  if (dismissed || count === 0) return null;

  return (
    <View style={[styles.banner, { backgroundColor: colors.backgroundElement }]}>
      <ThemedText type="smallBold">
        {books(count)} {count === 1 ? 'is' : 'are'} saved only on this device
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Move {count === 1 ? 'it' : 'them'} to your account to see {count === 1 ? 'it' : 'them'} on
        all your devices. Duplicates are merged.
      </ThemedText>
      {move.isError && (
        <ThemedText type="small" style={{ color: colors.danger }}>
          Couldn&apos;t move your books. Check your connection and try again.
        </ThemedText>
      )}
      <View style={styles.actions}>
        <View style={styles.action}>
          <Button label="Move to my account" busy={move.isPending} onPress={() => move.mutate()} />
        </View>
        <View style={styles.action}>
          <Button label="Not now" variant="secondary" onPress={() => setDismissed(true)} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  action: {
    flex: 1,
  },
});
