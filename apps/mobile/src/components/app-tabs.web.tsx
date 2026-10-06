import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Pressable, View, StyleSheet, useWindowDimensions } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { MaxContentWidth, Spacing } from '@/constants/theme';

/** Web navigation: a top bar built from Expo Router's headless tabs. */
export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="index" href="/" asChild>
            <TabButton>Collection</TabButton>
          </TabTrigger>
          <TabTrigger name="universes" href="/universes" asChild>
            <TabButton>Universes</TabButton>
          </TabTrigger>
          <TabTrigger name="add" href="/add" asChild>
            <TabButton>Add</TabButton>
          </TabTrigger>
          <TabTrigger name="account" href="/account" asChild>
            <TabButton>Account</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

/** Below this width the bar drops the brand and tightens up, so four tabs fit a phone. */
const COMPACT_WIDTH = 520;

function useCompact(): boolean {
  return useWindowDimensions().width < COMPACT_WIDTH;
}

export function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  const compact = useCompact();
  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView
        type={isFocused ? 'backgroundSelected' : 'backgroundElement'}
        style={[styles.tabButtonView, compact && styles.tabButtonCompact]}
      >
        <ThemedText type="small" themeColor={isFocused ? 'text' : 'textSecondary'}>
          {children}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  const compact = useCompact();
  return (
    <View {...props} style={[styles.tabListContainer, compact && styles.tabListCompact]}>
      <ThemedView
        type="backgroundElement"
        style={[styles.innerContainer, compact && styles.innerCompact]}
      >
        {compact ? null : (
          <ThemedText type="smallBold" themeColor="accent" style={styles.brandText}>
            Fandex
          </ThemedText>
        )}
        {props.children}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    width: '100%',
    padding: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
  },
  tabListCompact: {
    padding: Spacing.two,
  },
  innerCompact: {
    paddingHorizontal: Spacing.two,
    gap: Spacing.one,
    justifyContent: 'space-between',
  },
  brandText: {
    marginRight: 'auto',
  },
  pressed: {
    opacity: 0.7,
  },
  tabButtonView: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  tabButtonCompact: {
    paddingHorizontal: Spacing.two,
  },
});
