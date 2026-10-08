import { useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = Pick<
  TextInputProps,
  'value' | 'onChangeText' | 'placeholder' | 'accessibilityLabel' | 'onSubmitEditing' | 'autoFocus'
> & {
  busy?: boolean;
};

export function SearchField({ busy = false, ...inputProps }: Props) {
  const colors = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.backgroundElement,
          borderColor: focused ? colors.accent : 'transparent',
        },
      ]}
    >
      <TextInput
        {...inputProps}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.input, { color: colors.text }]}
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
        enterKeyHint="search"
        inputMode="search"
      />
      {busy && <ActivityIndicator testID="search-busy" color={colors.textSecondary} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Spacing.three,
    borderWidth: 2,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.three,
  },
});
