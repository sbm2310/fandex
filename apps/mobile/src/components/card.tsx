import { StyleSheet, View, type ViewProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/** A surface for grouped content: rounded, on the card colour, with a hairline border. */
export function Card({ style, ...rest }: ViewProps) {
  const colors = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.backgroundElement, borderColor: colors.border },
        style,
      ]}
      {...rest}
    />
  );
}

/** The same look as a style, for `<Link asChild>` children (which need one flattened style). */
export function cardStyle(colors: ReturnType<typeof useTheme>) {
  return StyleSheet.flatten([
    styles.card,
    { backgroundColor: colors.backgroundElement, borderColor: colors.border },
  ]);
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
});
