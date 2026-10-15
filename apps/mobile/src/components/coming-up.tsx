import { formatMoney, type Currency, type PreorderResponse } from '@fandex/core';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';

import { Fonts, Spacing } from '@/constants/theme';
import { useUpcoming } from '@/hooks/use-preorders';
import { useTheme } from '@/hooks/use-theme';
import { attentionText, countdownText, timelineDate } from '@/utils/preorder-text';
import { localToday } from '@/utils/today';

/** How many pre-order events the home screen shows. */
const SHOWN = 2;

type Event = { preorder: PreorderResponse; line: string; urgent: boolean; day?: string };

/**
 * The next pre-order events for the home screen: what needs doing first (amber), then what
 * arrives soonest. Nothing for guests or when nothing is on order.
 */
export function useComingUp(): Event[] {
  const { groups } = useUpcoming();
  if (!groups) return [];
  const today = localToday();
  const events: Event[] = [
    ...groups.attention.map(({ preorder, reasons }) => {
      const first = reasons[0]!;
      return {
        preorder,
        line: attentionText(first, preorder),
        urgent: true,
        ...('day' in first && { day: first.day }),
      };
    }),
    ...[...groups.thisMonth, ...groups.later].map((preorder) => ({
      preorder,
      line:
        (preorder.expectedRelease && countdownText(preorder.expectedRelease, today)) ?? 'On order',
      urgent: false,
    })),
  ];
  return events.slice(0, SHOWN);
}

/** One event: a date tile, the item and what's happening, opening the pre-order. */
export function ComingUpRow({ event }: { event: Event }) {
  const colors = useTheme();
  const { preorder, line, urgent } = event;
  const release = preorder.expectedRelease;
  const date = event.day
    ? timelineDate({ date: event.day, precision: 'day' })
    : release
      ? timelineDate(release)
      : { small: '', big: '–' };
  const owed =
    urgent && preorder.price !== undefined
      ? formatMoney(preorder.price - preorder.paid, preorder.currency as Currency)
      : undefined;
  return (
    // Link asChild needs a single style object on its child (no arrays or style functions).
    <Link href={{ pathname: '/preorder/[id]', params: { id: preorder.id } }} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${preorder.catalog.title}: ${line}`}
        style={StyleSheet.flatten([
          styles.row,
          urgent
            ? { backgroundColor: colors.moneyGround, borderColor: `${colors.money}40` }
            : { backgroundColor: colors.backgroundElement, borderColor: colors.border },
        ])}
      >
        <View
          style={[
            styles.date,
            { backgroundColor: urgent ? colors.money : colors.backgroundSelected },
          ]}
        >
          <ThemedText
            style={[
              styles.dateSmall,
              { color: urgent ? colors.moneyGround : colors.textSecondary },
            ]}
          >
            {date.small}
          </ThemedText>
          <ThemedText
            style={[styles.dateBig, { color: urgent ? colors.moneyGround : colors.text }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {date.big}
          </ThemedText>
        </View>
        <View style={styles.text}>
          <ThemedText type="smallBold" numberOfLines={1}>
            {owed && line.startsWith('Balance') ? `${owed} balance due` : preorder.catalog.title}
          </ThemedText>
          <ThemedText
            type="small"
            numberOfLines={2}
            style={{ color: urgent ? colors.money : colors.textSecondary }}
          >
            {owed && line.startsWith('Balance') ? preorder.catalog.title : line}
          </ThemedText>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  date: {
    width: 52,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.one,
  },
  dateSmall: {
    fontFamily: Fonts.bold,
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: 0.6,
  },
  dateBig: {
    fontFamily: Fonts.display,
    fontSize: 20,
    lineHeight: 23,
  },
  text: {
    flex: 1,
    gap: Spacing.half,
  },
});
