import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from './themed-text';

import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = Omit<TextInputProps, 'style'> & { label: string };

/** A labelled text input. The label doubles as the accessibility label. */
export function FormField({ label, ...inputProps }: Props) {
  const colors = useTheme();
  return (
    <View style={styles.container}>
      {/* Hidden from screen readers (and UI tests): the input carries the label, so it's read once. */}
      <ThemedText
        type="smallBold"
        themeColor="textSecondary"
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {label}
      </ThemedText>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textSecondary}
        {...inputProps}
        style={[
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.backgroundElement,
            borderColor: colors.border,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
  },
  input: {
    fontFamily: Fonts.regular,
    fontSize: 16,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
});
