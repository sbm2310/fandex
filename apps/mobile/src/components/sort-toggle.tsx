import type { CollectionSort } from '@fandex/core';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const OPTIONS: { value: CollectionSort; label: string }[] = [
  { value: 'recent', label: 'Recent' },
  { value: 'title', label: 'Title' },
];

/** A two-option segmented control for the collection's sort order. */
export function SortToggle({
  value,
  onChange,
}: {
  value: CollectionSort;
  onChange: (sort: CollectionSort) => void;
}) {
  const colors = useTheme();

  return (
    <View
      style={[styles.container, { backgroundColor: colors.backgroundElement }]}
      accessibilityRole="radiogroup"
      accessibilityLabel="Sort by"
    >
      {OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={`Sort by ${option.label.toLowerCase()}`}
            onPress={() => onChange(option.value)}
            style={[styles.option, selected && { backgroundColor: colors.backgroundSelected }]}
          >
            <ThemedText type="small" themeColor={selected ? 'text' : 'textSecondary'}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: Spacing.three,
    padding: Spacing.half,
  },
  option: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three - Spacing.half,
  },
});
