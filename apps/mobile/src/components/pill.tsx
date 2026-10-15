import { StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';

import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  label: string;
  /** accent: a status ("in 26 days"); money: something to pay or a date that slipped. */
  tone?: 'accent' | 'money' | 'neutral';
};

/** A small rounded label: categories, countdowns, "Delayed once". */
export function Pill({ label, tone = 'accent' }: Props) {
  const colors = useTheme();
  const look = {
    accent: { backgroundColor: colors.backgroundSelected, color: colors.accent },
    money: { backgroundColor: colors.moneyGround, color: colors.money },
    neutral: { backgroundColor: colors.backgroundSelected, color: colors.textSecondary },
  }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: look.backgroundColor }]}>
      <ThemedText style={[styles.text, { color: look.color }]}>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  text: {
    fontFamily: Fonts.bold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.3,
  },
});
