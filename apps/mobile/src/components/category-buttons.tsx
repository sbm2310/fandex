import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';

import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type CategoryButtonOption<T extends string> = {
  value: T;
  label: string;
  /** SF Symbol on iOS, Material Symbol on Android and web. */
  icon: SymbolViewProps['name'];
};

/** Icon-and-label tiles for picking what to add (a radio group), one row wide. */
export function CategoryButtons<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: readonly CategoryButtonOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
}) {
  const colors = useTheme();
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.button,
              {
                backgroundColor: selected ? colors.backgroundSelected : colors.backgroundElement,
                borderColor: selected ? colors.accent : colors.border,
              },
              pressed && styles.pressed,
            ]}
          >
            <SymbolView
              name={option.icon}
              tintColor={selected ? colors.accent : colors.textSecondary}
              size={22}
            />
            <ThemedText
              type="small"
              themeColor={selected ? 'text' : 'textSecondary'}
              style={styles.label}
            >
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  button: {
    flex: 1,
    minHeight: 64,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
  },
  label: {
    fontFamily: Fonts.bold,
  },
  pressed: {
    opacity: 0.7,
  },
});
