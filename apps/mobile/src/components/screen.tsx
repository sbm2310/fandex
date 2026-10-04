import type { ReactNode } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from './themed-view';

import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

/**
 * Page wrapper for tab screens: themed background, safe-area padding, room for the
 * tab bar, and a centered max-width column so screens read well on wide web windows.
 */
export function Screen({ children }: { children: ReactNode }) {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>{children}</SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    // The web tab bar is a floating top bar; native tab bars sit at the bottom.
    paddingTop: Platform.OS === 'web' ? Spacing.six + Spacing.four : 0,
    paddingBottom: BottomTabInset + Spacing.three,
    gap: Spacing.three,
  },
});
