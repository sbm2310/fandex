import {
  formatRelease,
  releaseDate,
  releasePeriodEnd,
  type ReleaseDate,
  type ReleasePrecision,
} from '@fandex/core';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { SegmentedControl } from './segmented-control';
import { ThemedText } from './themed-text';

import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PRECISION_LABELS: Record<ReleasePrecision, string> = {
  day: 'Day',
  month: 'Month',
  quarter: 'Quarter',
  year: 'Year',
};

type Props = {
  label: string;
  value: ReleaseDate | null;
  onChange: (value: ReleaseDate | null) => void;
  /** Which precisions to offer (a payment is due on a day; a release can be "Q1 2027"). */
  precisions: readonly ReleasePrecision[];
  /** The date a new value starts from (YYYY-MM-DD), e.g. today. */
  startFrom: string;
};

function parts(value: ReleaseDate) {
  const [year, month, day] = value.date.split('-').map(Number);
  return { year: year!, month: month!, day: day! };
}

function iso(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** The same day in another month or year, kept inside that month ("31" in February → 28). */
function withParts(value: ReleaseDate, change: Partial<ReturnType<typeof parts>>): ReleaseDate {
  const next = { ...parts(value), ...change };
  const lastDay = Number(
    releasePeriodEnd(releaseDate(iso(next.year, next.month, 1), 'month')).slice(8),
  );
  return releaseDate(iso(next.year, next.month, Math.min(next.day, lastDay)), value.precision);
}

/**
 * A date as precise as it's known: a day, a month, a quarter or a year. Buttons rather than a
 * native picker, so it works the same on iPhone and the web and can say "Q1 2027".
 */
export function ReleaseDateField({ label, value, onChange, precisions, startFrom }: Props) {
  const colors = useTheme();
  const chip = (selected: boolean) =>
    StyleSheet.flatten([styles.chip, { borderColor: selected ? colors.accent : colors.border }]);

  if (!value) {
    return (
      <View style={styles.container}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          {label}
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Set ${label.toLowerCase()}`}
          onPress={() =>
            onChange(
              releaseDate(startFrom, precisions.includes('month') ? 'month' : precisions[0]!),
            )
          }
          style={chip(false)}
        >
          <ThemedText type="small">Not set · Set a date</ThemedText>
        </Pressable>
      </View>
    );
  }

  const { year, month, day } = parts(value);
  const quarter = Math.floor((month - 1) / 3) + 1;

  return (
    <View style={styles.container} accessibilityLabel={`${label}: ${formatRelease(value)}`}>
      <View style={styles.header}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          {label}: {formatRelease(value)}
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Clear ${label.toLowerCase()}`}
          onPress={() => onChange(null)}
          hitSlop={8}
        >
          <ThemedText type="linkPrimary">Clear</ThemedText>
        </Pressable>
      </View>

      {precisions.length > 1 && (
        <SegmentedControl
          options={precisions.map((precision) => ({
            value: precision,
            label: PRECISION_LABELS[precision],
          }))}
          value={value.precision}
          onChange={(precision) => onChange(releaseDate(value.date, precision))}
          accessibilityLabel={`${label} precision`}
        />
      )}

      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: previous year`}
          onPress={() => onChange(withParts(value, { year: year - 1 }))}
          style={chip(false)}
        >
          <ThemedText type="small">‹</ThemedText>
        </Pressable>
        <ThemedText type="smallBold" accessibilityLabel={`Year ${year}`}>
          {year}
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: next year`}
          onPress={() => onChange(withParts(value, { year: year + 1 }))}
          style={chip(false)}
        >
          <ThemedText type="small">›</ThemedText>
        </Pressable>
      </View>

      {(value.precision === 'day' || value.precision === 'month') && (
        <View style={styles.wrap}>
          {MONTHS.map((name, index) => (
            <Pressable
              key={name}
              accessibilityRole="button"
              accessibilityLabel={`${label}: ${name}`}
              accessibilityState={{ selected: month === index + 1 }}
              onPress={() => onChange(withParts(value, { month: index + 1 }))}
              style={chip(month === index + 1)}
            >
              <ThemedText type="small">{name}</ThemedText>
            </Pressable>
          ))}
        </View>
      )}
      {value.precision === 'quarter' && (
        <View style={styles.wrap}>
          {[1, 2, 3, 4].map((q) => (
            <Pressable
              key={q}
              accessibilityRole="button"
              accessibilityLabel={`${label}: Q${q}`}
              accessibilityState={{ selected: quarter === q }}
              onPress={() => onChange(withParts(value, { month: (q - 1) * 3 + 1 }))}
              style={chip(quarter === q)}
            >
              <ThemedText type="small">Q{q}</ThemedText>
            </Pressable>
          ))}
        </View>
      )}
      {value.precision === 'day' && (
        <View style={styles.row}>
          <ThemedText type="small" themeColor="textSecondary">
            Day
          </ThemedText>
          <TextInput
            accessibilityLabel={`${label}: day`}
            value={String(day)}
            onChangeText={(text) => {
              const typed = Number(text.replace(/\D/g, ''));
              if (typed >= 1 && typed <= 31) onChange(withParts(value, { day: typed }));
            }}
            keyboardType="number-pad"
            maxLength={2}
            style={[
              styles.day,
              {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.backgroundElement,
              },
            ]}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    borderWidth: 1,
    borderRadius: Spacing.four,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    alignSelf: 'flex-start',
  },
  day: {
    width: 56,
    fontFamily: Fonts.regular,
    fontSize: 16,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    textAlign: 'center',
  },
});
