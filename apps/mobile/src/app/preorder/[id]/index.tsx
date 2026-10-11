import {
  balanceLeft,
  describeSlips,
  formatMoney,
  formatRelease,
  needsAttention,
  type Currency,
  type PreorderResponse,
} from '@fandex/core';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { EntryRow } from '@/components/entry-row';
import { PageTitle } from '@/components/page-title';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import {
  useArrivePreorder,
  useDeletePreorder,
  usePreorder,
  useUpdatePreorder,
} from '@/hooks/use-preorders';
import { useTheme } from '@/hooks/use-theme';
import { toCatalogEntry } from '@/services/catalog-mapping';
import { confirm } from '@/utils/confirm';
import { attentionText, day } from '@/utils/preorder-text';
import { localToday } from '@/utils/today';

/** A pre-order: what's owed and when, its dates and their history, and what to do next. */
export default function PreorderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { preorder, isPending, signedIn, userPending } = usePreorder(id);

  if (userPending || (signedIn && isPending)) {
    return (
      <ThemedView style={[styles.fill, styles.centered]}>
        <PageTitle title="Pre-order" />
        <ActivityIndicator accessibilityLabel="Loading" />
      </ThemedView>
    );
  }
  if (!preorder) {
    return (
      <ThemedView style={styles.fill}>
        <PageTitle title="Not found" />
        <EmptyState
          title="No such pre-order"
          message={signedIn ? 'It may have been deleted.' : 'Sign in to see your pre-orders.'}
          action={
            signedIn
              ? { label: 'Upcoming', href: '/upcoming' }
              : { label: 'Sign in', href: '/account' }
          }
        />
      </ThemedView>
    );
  }
  return <PreorderDetail preorder={preorder} />;
}

function PreorderDetail({ preorder }: { preorder: PreorderResponse }) {
  const colors = useTheme();
  const update = useUpdatePreorder();
  const arrive = useArrivePreorder();
  const remove = useDeletePreorder();
  const entry = toCatalogEntry(preorder.catalog);
  const currency = preorder.currency as Currency;
  const left = balanceLeft(preorder);
  const reasons = needsAttention(preorder, localToday());
  const slips = describeSlips(preorder.history);
  const status =
    preorder.status === 'arrived'
      ? `Arrived${preorder.arrivedAt ? ` ${day(preorder.arrivedAt.slice(0, 10))}` : ''}`
      : preorder.status === 'cancelled'
        ? 'Cancelled'
        : 'On order';

  const onDelete = async () => {
    const yes = await confirm({
      title: 'Delete this pre-order?',
      message: 'Its payments and dates are deleted. Anything already in your collection stays.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (yes) remove.mutate(preorder.id, { onSuccess: () => router.replace('/upcoming') });
  };

  return (
    <ThemedView style={styles.fill}>
      <PageTitle title={`Pre-order: ${preorder.catalog.title}`} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.column}>
          {entry ? <EntryRow entry={entry} showUniverses={false} /> : null}
          <ThemedText type="smallBold" accessibilityRole="header">
            {status}
          </ThemedText>

          {reasons.map((reason) => (
            <View
              key={reason.kind}
              style={[styles.attention, { borderColor: colors.accent }]}
              accessibilityRole="alert"
            >
              <ThemedText type="smallBold">{attentionText(reason, preorder)}</ThemedText>
            </View>
          ))}

          <View style={styles.facts}>
            <Fact
              label="Price"
              value={
                preorder.price !== undefined
                  ? formatMoney(preorder.price, currency)
                  : 'Not known yet'
              }
            />
            <Fact label="Paid" value={formatMoney(preorder.paid, currency)} />
            {left !== undefined ? (
              <Fact label="Balance left" value={formatMoney(left, currency)} />
            ) : null}
            {preorder.balanceDueDate ? (
              <Fact label="Balance due" value={day(preorder.balanceDueDate)} />
            ) : null}
            <Fact
              label="Expected"
              value={
                preorder.expectedRelease
                  ? `${formatRelease(preorder.expectedRelease)}${
                      preorder.followsCatalogDate && preorder.status === 'ordered'
                        ? ' (Open Library, checked daily)'
                        : ''
                    }`
                  : 'No date yet'
              }
            />
            {slips ? <Fact label="Changes" value={slips} /> : null}
            {preorder.store ? <Fact label="Store" value={preorder.store} /> : null}
            {preorder.orderNumber ? (
              <Fact label="Order number" value={preorder.orderNumber} />
            ) : null}
          </View>
          {preorder.orderUrl ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Open the order on the store's website"
              onPress={() => void Linking.openURL(preorder.orderUrl!)}
            >
              <ThemedText type="linkPrimary">Open the order</ThemedText>
            </Pressable>
          ) : null}
          {preorder.notes ? <ThemedText>{preorder.notes}</ThemedText> : null}

          {preorder.history.length > 1 ? (
            <View style={styles.history}>
              <ThemedText type="smallBold" accessibilityRole="header">
                Date history
              </ThemedText>
              {preorder.history.map((change) => (
                <ThemedText key={change.changedAt} type="small" themeColor="textSecondary">
                  {day(change.changedAt.slice(0, 10))}:{' '}
                  {change.from ? `${formatRelease(change.from)} → ` : 'set to '}
                  {change.to ? formatRelease(change.to) : 'no date'}
                  {change.source === 'openlibrary' ? ' (Open Library)' : ''}
                </ThemedText>
              ))}
            </View>
          ) : null}

          <View style={styles.actions}>
            {preorder.status === 'ordered' ? (
              <Button
                label="It arrived: add to collection"
                busy={arrive.isPending}
                onPress={() =>
                  arrive.mutate(preorder.id, {
                    onSuccess: ({ item }) =>
                      router.replace({ pathname: '/book/[id]', params: { id: item.id } }),
                  })
                }
              />
            ) : null}
            {preorder.status !== 'arrived' ? (
              <Button
                label="Edit"
                variant="secondary"
                onPress={() =>
                  router.push({ pathname: '/preorder/[id]/edit', params: { id: preorder.id } })
                }
              />
            ) : null}
            {preorder.status === 'ordered' ? (
              <Button
                label="Cancel the pre-order"
                variant="secondary"
                busy={update.isPending}
                onPress={() => update.mutate({ id: preorder.id, changes: { status: 'cancelled' } })}
              />
            ) : null}
            {preorder.status === 'cancelled' ? (
              <Button
                label="Reopen"
                variant="secondary"
                busy={update.isPending}
                onPress={() => update.mutate({ id: preorder.id, changes: { status: 'ordered' } })}
              />
            ) : null}
            <Button
              label="Delete"
              variant="danger"
              busy={remove.isPending}
              onPress={() => void onDelete()}
            />
            {arrive.isError || update.isError || remove.isError ? (
              <ThemedText type="smallBold" accessibilityRole="alert">
                Couldn&apos;t update the pre-order. Check your connection and try again.
              </ThemedText>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact} accessible accessibilityLabel={`${label}: ${value}`}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="small" style={styles.factValue}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    paddingVertical: Spacing.four,
  },
  column: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  attention: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
  },
  facts: {
    gap: Spacing.two,
  },
  fact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  factValue: {
    flexShrink: 1,
    textAlign: 'right',
  },
  history: {
    gap: Spacing.one,
  },
  actions: {
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
});
