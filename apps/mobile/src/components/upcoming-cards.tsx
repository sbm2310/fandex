import {
  balanceLeft,
  formatMoney,
  type AttentionReason,
  type Currency,
  type PreorderResponse,
} from '@fandex/core';
import { StyleSheet, View } from 'react-native';

import { Button } from './button';
import { Card } from './card';
import { Pill } from './pill';
import { PreorderRow } from './preorder-row';
import { ThemedText } from './themed-text';

import { Fonts, Spacing } from '@/constants/theme';
import { useUpdatePreorder } from '@/hooks/use-preorders';
import { useTheme } from '@/hooks/use-theme';
import { confirm } from '@/utils/confirm';
import { attentionText, countdownText, delayText, timelineDate } from '@/utils/preorder-text';

/** "Still owed" (amber) and how many are on order, side by side. */
export function SummaryTiles({ owed, onOrder }: { owed: readonly string[]; onOrder: number }) {
  const colors = useTheme();
  return (
    <View style={styles.tiles}>
      {owed.length > 0 && (
        <Card
          style={styles.tile}
          accessible
          accessibilityLabel={`Still owed: ${owed.join(' and ')}`}
        >
          <ThemedText type="small" themeColor="textSecondary">
            Still owed
          </ThemedText>
          <ThemedText style={[styles.tileValue, { color: colors.money }]}>
            {owed.join(' · ')}
          </ThemedText>
        </Card>
      )}
      <Card
        style={styles.tile}
        accessible
        accessibilityLabel={
          onOrder === 1 ? '1 pre-order on order' : `${onOrder} pre-orders on order`
        }
      >
        <ThemedText type="small" themeColor="textSecondary">
          On order
        </ThemedText>
        <ThemedText style={styles.tileValue}>
          {onOrder === 1 ? '1 item' : `${onOrder} items`}
        </ThemedText>
      </Card>
    </View>
  );
}

/**
 * A pre-order that needs something done, on the amber ground: the row (a link to it), how much
 * is paid of the price, and "I've paid it" while a balance is left.
 */
export function AttentionCard({
  preorder,
  reasons,
}: {
  preorder: PreorderResponse;
  reasons: readonly AttentionReason[];
}) {
  const colors = useTheme();
  const update = useUpdatePreorder();
  const currency = preorder.currency as Currency;
  const left = balanceLeft(preorder);
  const { price } = preorder;
  const title = preorder.catalog.title;

  async function markPaid() {
    if (price === undefined || !left) return;
    const confirmed = await confirm({
      title: 'Paid in full?',
      message: `“${title}”: ${formatMoney(left, currency)} paid, so all ${formatMoney(price, currency)} is paid.`,
      confirmLabel: "I've paid it",
    });
    if (confirmed) update.mutate({ id: preorder.id, changes: { paid: price } });
  }

  return (
    <View
      style={[
        styles.attention,
        // A hairline of the amber itself, a quarter strength.
        { backgroundColor: colors.moneyGround, borderColor: `${colors.money}40` },
      ]}
    >
      <PreorderRow
        preorder={preorder}
        notes={reasons.map((reason) => attentionText(reason, preorder))}
      />
      {price !== undefined && price > 0 && (
        <PaymentBar paid={preorder.paid} price={price} currency={currency} />
      )}
      {left ? (
        <Button
          label="I've paid it"
          accessibilityLabel={`I've paid ${title} in full`}
          variant="money"
          busy={update.isPending}
          onPress={() => void markPaid()}
        />
      ) : null}
      {update.isError && (
        <ThemedText type="small" style={{ color: colors.danger }} accessibilityRole="alert">
          Couldn&apos;t save the payment. Try again.
        </ThemedText>
      )}
    </View>
  );
}

/** Paid of the price, as an amber bar with both amounts under it. */
function PaymentBar({
  paid,
  price,
  currency,
}: {
  paid: number;
  price: number;
  currency: Currency;
}) {
  const colors = useTheme();
  const share = Math.min(1, paid / price);
  return (
    <View
      style={styles.payment}
      accessible
      accessibilityLabel={`${formatMoney(paid, currency)} paid of ${formatMoney(price, currency)}`}
    >
      <View style={[styles.track, { backgroundColor: `${colors.money}33` }]}>
        <View
          style={[
            styles.fill,
            { width: `${Math.round(share * 100)}%`, backgroundColor: colors.money },
          ]}
        />
      </View>
      <View style={styles.amounts}>
        <ThemedText type="small" style={{ color: colors.money }}>
          {formatMoney(paid, currency)} paid
        </ThemedText>
        <ThemedText type="small" style={{ color: colors.money }}>
          of {formatMoney(price, currency)}
        </ThemedText>
      </View>
    </View>
  );
}

/**
 * One pre-order on the timeline: its expected date in a column on the left, the row in a card
 * with how far off it is ("in 26 days") and whether it slipped ("Delayed once").
 */
export function TimelineRow({ preorder, today }: { preorder: PreorderResponse; today: string }) {
  const colors = useTheme();
  const release = preorder.expectedRelease;
  const date = release ? timelineDate(release) : { small: '', big: '–' };
  const open = preorder.status === 'ordered';
  const countdown = open && release ? countdownText(release, today) : undefined;
  const delayed = open ? delayText(preorder.history) : undefined;
  const pills =
    countdown || delayed ? (
      <View style={styles.pills}>
        {countdown ? <Pill label={countdown} /> : null}
        {delayed ? <Pill label={delayed} tone="money" /> : null}
      </View>
    ) : undefined;

  return (
    <View style={styles.timelineRow}>
      {/* The date is read out in the row's own label, so the column is decoration. */}
      <View
        style={styles.dateColumn}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <ThemedText style={styles.dateSmall} themeColor="textSecondary">
          {date.small}
        </ThemedText>
        <ThemedText
          style={styles.dateBig}
          themeColor={open ? 'text' : 'textSecondary'}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {date.big}
        </ThemedText>
        <View style={[styles.line, { backgroundColor: colors.border }]} />
      </View>
      <Card style={styles.timelineCard}>
        <PreorderRow preorder={preorder} footer={pills} />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  tiles: {
    flexDirection: 'row',
    gap: 10,
  },
  tile: {
    flex: 1,
    gap: Spacing.half,
  },
  tileValue: {
    fontFamily: Fonts.display,
    fontSize: 24,
    lineHeight: 30,
  },
  attention: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    paddingTop: Spacing.two,
    gap: Spacing.three,
  },
  payment: {
    gap: Spacing.one,
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: 8,
    borderRadius: 4,
  },
  amounts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timelineRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  dateColumn: {
    width: 52,
    alignItems: 'center',
    paddingTop: Spacing.two,
  },
  dateSmall: {
    fontFamily: Fonts.bold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.6,
  },
  dateBig: {
    fontFamily: Fonts.display,
    fontSize: 20,
    lineHeight: 24,
  },
  line: {
    flex: 1,
    width: 2,
    marginTop: Spacing.one,
    borderRadius: 1,
  },
  timelineCard: {
    flex: 1,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    paddingTop: Spacing.one,
  },
});
