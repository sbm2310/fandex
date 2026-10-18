import { CURRENCIES, type Currency } from '@fandex/core';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Picks one of core's currencies: a labelled row of radio chips. */
export function CurrencyChips({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Currency;
  onChange: (currency: Currency) => void;
}) {
  const colors = useTheme();
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>
      <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {CURRENCIES.map((option) => (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityLabel={option}
            aria-checked={value === option}
            onPress={() => onChange(option)}
            style={StyleSheet.flatten([
              styles.chip,
              { borderColor: value === option ? colors.accent : colors.border },
            ])}
          >
            <ThemedText type="small">{option}</ThemedText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
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
  },
});
