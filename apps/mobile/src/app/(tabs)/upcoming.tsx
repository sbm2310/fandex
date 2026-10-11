import { formatMoney, type Currency, type PreorderResponse } from '@fandex/core';
import type { ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { PageTitle } from '@/components/page-title';
import { PreorderRow } from '@/components/preorder-row';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useUpcoming } from '@/hooks/use-preorders';
import { attentionText } from '@/utils/preorder-text';

/**
 * What's on order: what needs doing first (payments due, dates passed, arriving this week), then
 * by expected date, with what's still owed. The tab's badge counts the first group.
 */
export default function UpcomingScreen() {
  const { groups, closed, isPending, isError, signedIn, userPending } = useUpcoming();

  if (userPending || (signedIn && isPending)) {
    return (
      <Screen>
        <PageTitle title="Upcoming" />
        <View style={styles.centered}>
          <ActivityIndicator accessibilityLabel="Loading your pre-orders" />
        </View>
      </Screen>
    );
  }
  if (!signedIn) {
    return (
      <Screen>
        <PageTitle title="Upcoming" />
        <EmptyState
          title="Sign in to track pre-orders"
          message="Pre-orders keep payments and release dates in your account, on all your devices."
          action={{ label: 'Sign in', href: '/account' }}
        />
      </Screen>
    );
  }
  if (isError || !groups) {
    return (
      <Screen>
        <PageTitle title="Upcoming" />
        <EmptyState
          title="Couldn't load your pre-orders"
          message="Can't reach the Fandex server. Check your connection and try again."
        />
      </Screen>
    );
  }

  const open = groups.attention.length + groups.thisMonth.length + groups.later.length;
  const total = open + groups.noDate.length;
  if (total === 0 && closed.length === 0) {
    return (
      <Screen>
        <PageTitle title="Upcoming" />
        <EmptyState
          title="Nothing on order"
          message="Find something on the Add tab and choose Pre-order, or describe a figure that's on order."
          action={{ label: 'Go to Add', href: '/add' }}
        />
      </Screen>
    );
  }

  const owed = (Object.entries(groups.owed) as [Currency, number][]).map(([currency, amount]) =>
    formatMoney(amount, currency),
  );
  const rows = (preorders: readonly PreorderResponse[]) =>
    preorders.map((preorder) => <PreorderRow key={preorder.id} preorder={preorder} />);

  return (
    <Screen>
      <PageTitle title="Upcoming" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <ThemedText type="subtitle">Upcoming</ThemedText>
          <ThemedText themeColor="textSecondary">
            {total === 1 ? '1 pre-order on order' : `${total} pre-orders on order`}
          </ThemedText>
          {owed.length > 0 && (
            <ThemedText type="smallBold" accessibilityLabel={`Still owed: ${owed.join(' and ')}`}>
              Still owed: {owed.join(' · ')}
            </ThemedText>
          )}
        </View>

        <Section title="Needs attention" count={groups.attention.length}>
          {groups.attention.map(({ preorder, reasons }) => (
            <PreorderRow
              key={preorder.id}
              preorder={preorder}
              notes={reasons.map((reason) => attentionText(reason, preorder))}
            />
          ))}
        </Section>
        <Section title="Arriving this month" count={groups.thisMonth.length}>
          {rows(groups.thisMonth)}
        </Section>
        <Section title="Later" count={groups.later.length}>
          {rows(groups.later)}
        </Section>
        <Section title="Date not known yet" count={groups.noDate.length}>
          {rows(groups.noDate)}
        </Section>
        <Section title="Arrived or cancelled" count={closed.length}>
          {rows(closed)}
        </Section>
      </ScrollView>
    </Screen>
  );
}

/** A titled group; nothing when it's empty. */
function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  if (count === 0) return null;
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header">
        {title} · {count}
      </ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { gap: Spacing.four, paddingBottom: Spacing.four },
  header: { gap: Spacing.one },
  section: { gap: Spacing.one },
});
