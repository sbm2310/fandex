import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { Fonts } from '@/constants/theme';
import { useUpcoming } from '@/hooks/use-preorders';
import { useTheme } from '@/hooks/use-theme';

/** Bottom tab bar using the platform's native tab bar (UITabBarController on iOS). */
export default function AppTabs() {
  const colors = useTheme();
  // The badge is the reminder (no notifications): how many pre-orders need something done.
  const { attentionCount } = useUpcoming();

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      tintColor={colors.accent}
      labelStyle={{
        default: { fontFamily: Fonts.semiBold },
        selected: { fontFamily: Fonts.semiBold, color: colors.accent },
      }}
      // Amber means "needs attention" across the app.
      badgeBackgroundColor={colors.money}
      badgeTextColor={colors.moneyGround}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Collection</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="books.vertical.fill" md="shelves" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="universes">
        <NativeTabs.Trigger.Label>Universes</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="sparkles" md="auto_awesome" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="add">
        <NativeTabs.Trigger.Label>Add</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="plus.circle.fill" md="add_circle" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="upcoming">
        <NativeTabs.Trigger.Label>Upcoming</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="calendar" md="event" />
        {/* Expo Router ignores `hidden` on a badge with text (it showed "0"), so no text at 0. */}
        {attentionCount > 0 ? (
          <NativeTabs.Trigger.Badge>{String(attentionCount)}</NativeTabs.Trigger.Badge>
        ) : (
          <NativeTabs.Trigger.Badge hidden />
        )}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="account">
        <NativeTabs.Trigger.Label>Account</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle" md="account_circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
