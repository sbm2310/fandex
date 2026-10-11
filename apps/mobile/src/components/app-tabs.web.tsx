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
import { useUpcoming } from '@/hooks/use-preorders';
import { useTheme } from '@/hooks/use-theme';

/** Web navigation: a top bar built from Expo Router's headless tabs. */
export default function AppTabs() {
  // The badge is the reminder (no notifications): how many pre-orders need something done.
  const { attentionCount } = useUpcoming();
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
          <TabTrigger name="upcoming" href="/upcoming" asChild>
            <TabButton badge={attentionCount}>Upcoming</TabButton>
          </TabTrigger>
          <TabTrigger name="account" href="/account" asChild>
            <TabButton>Account</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

/** Below this width the bar drops the brand and tightens up, so five tabs fit a phone. */
const COMPACT_WIDTH = 520;

function useCompact(): boolean {
  return useWindowDimensions().width < COMPACT_WIDTH;
}

type TabButtonProps = TabTriggerSlotProps & {
  /** A count shown next to the label (hidden at 0). */
  badge?: number;
};

export function TabButton({ children, isFocused, badge = 0, ...props }: TabButtonProps) {
  const compact = useCompact();
  const colors = useTheme();
  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView
        type={isFocused ? 'backgroundSelected' : 'backgroundElement'}
        style={[styles.tabButtonView, compact && styles.tabButtonCompact]}
      >
        <ThemedText
          type="small"
          themeColor={isFocused ? 'text' : 'textSecondary'}
          style={compact && styles.labelCompact}
        >
          {children}
        </ThemedText>
        {badge > 0 && (
          <View
            accessibilityLabel={`${badge} need attention`}
            style={[styles.badge, { backgroundColor: colors.accent }]}
          >
            <ThemedText type="smallBold" style={[styles.badgeText, { color: colors.onAccent }]}>
              {badge}
            </ThemedText>
          </View>
        )}
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
    padding: Spacing.one,
  },
  innerCompact: {
    paddingHorizontal: Spacing.one,
    gap: 0,
    justifyContent: 'space-between',
  },
  brandText: {
    marginRight: 'auto',
  },
  pressed: {
    opacity: 0.7,
  },
  tabButtonView: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 11,
    lineHeight: 14,
  },
  tabButtonCompact: {
    paddingHorizontal: Spacing.one + Spacing.half,
    gap: Spacing.half,
  },
  labelCompact: {
    fontSize: 13,
  },
});
