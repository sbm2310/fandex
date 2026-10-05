import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from './themed-text';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  busy?: boolean;
  disabled?: boolean;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  busy = false,
  disabled = false,
}: Props) {
  const colors = useTheme();
  const inactive = busy || disabled;
  const look = {
    primary: { backgroundColor: colors.accent, borderColor: colors.accent, text: colors.onAccent },
    secondary: { backgroundColor: 'transparent', borderColor: colors.border, text: colors.text },
    danger: { backgroundColor: 'transparent', borderColor: colors.danger, text: colors.danger },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: look.backgroundColor, borderColor: look.borderColor },
        (pressed || inactive) && styles.dimmed,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={look.text} />
      ) : (
        <ThemedText type="smallBold" style={{ color: look.text }}>
          {label}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  dimmed: {
    opacity: 0.6,
  },
});
