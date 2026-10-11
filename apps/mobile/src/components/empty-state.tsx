import { Link, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  title: string;
  message: string;
  /** A link somewhere else, or something to do here ("Try again"). */
  action?: { label: string; href: Href } | { label: string; onPress: () => void };
};

export function EmptyState({ title, message, action }: Props) {
  const colors = useTheme();

  return (
    <View style={styles.container}>
      <ThemedText type="subtitle" style={styles.centered}>
        {title}
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.centered}>
        {message}
      </ThemedText>
      {action && 'href' in action ? (
        // Link asChild needs a single style object on its child (no arrays or style functions).
        <Link href={action.href} asChild>
          <Pressable
            style={StyleSheet.flatten([styles.button, { backgroundColor: colors.accent }])}
          >
            <ThemedText type="smallBold" themeColor="onAccent">
              {action.label}
            </ThemedText>
          </Pressable>
        </Link>
      ) : action ? (
        <Pressable
          accessibilityRole="button"
          onPress={action.onPress}
          style={StyleSheet.flatten([styles.button, { backgroundColor: colors.accent }])}
        >
          <ThemedText type="smallBold" themeColor="onAccent">
            {action.label}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  centered: {
    textAlign: 'center',
  },
  button: {
    marginTop: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.five,
  },
});
