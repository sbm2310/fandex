import { NativeTabs } from 'expo-router/unstable-native-tabs';

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
      labelStyle={{ selected: { color: colors.accent } }}
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
        <NativeTabs.Trigger.Badge hidden={attentionCount === 0}>
          {String(attentionCount)}
        </NativeTabs.Trigger.Badge>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="account">
        <NativeTabs.Trigger.Label>Account</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle" md="account_circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
