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
import { Card } from '@/components/card';
import { PreorderUnavailable } from '@/components/preorder-unavailable';
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
import { preorderErrorMessage } from '@/utils/preorder-error';
import { localToday } from '@/utils/today';

/** A pre-order: what's owed and when, its dates and their history, and what to do next. */
export default function PreorderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { preorder, isPending, isError, signedIn, userPending, refetch } = usePreorder(id);

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
        <PreorderUnavailable signedIn={signedIn} failed={isError} retry={() => void refetch()} />
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
  // The server's reason when it refused ("This pre-order was cancelled"), else a general one.
  const failure = arrive.error ?? update.error ?? remove.error;
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
          <ThemedText type="overline" themeColor="textSecondary" accessibilityRole="header">
            {status}
          </ThemedText>

          {reasons.map((reason) => (
            <View
              key={reason.kind}
              style={[
                styles.attention,
                { backgroundColor: colors.moneyGround, borderColor: `${colors.money}40` },
              ]}
              accessibilityRole="alert"
            >
              <ThemedText type="smallBold" style={{ color: colors.money }}>
                {attentionText(reason, preorder)}
              </ThemedText>
            </View>
          ))}

          <Card style={styles.facts}>
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
              <Fact
                label="Balance left"
                value={formatMoney(left, currency)}
                money={left > 0 && preorder.status === 'ordered'}
              />
            ) : null}
            {preorder.balanceDueDate ? (
              <Fact
                label="Balance due"
                value={day(preorder.balanceDueDate)}
                money={!!left && preorder.status === 'ordered'}
              />
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
          </Card>
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
            <Card style={styles.history}>
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
            </Card>
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
            {failure ? (
              <ThemedText
                type="smallBold"
                style={{ color: colors.danger }}
                accessibilityRole="alert"
              >
                {preorderErrorMessage(failure, "Couldn't update the pre-order. Try again.")}
              </ThemedText>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

/** One line of the facts card; `money` sets the value in amber (a balance still to pay). */
function Fact({ label, value, money = false }: { label: string; value: string; money?: boolean }) {
  const colors = useTheme();
  return (
    <View style={styles.fact} accessible accessibilityLabel={`${label}: ${value}`}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="small" style={[styles.factValue, money && { color: colors.money }]}>
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
    borderRadius: 16,
    padding: 14,
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
