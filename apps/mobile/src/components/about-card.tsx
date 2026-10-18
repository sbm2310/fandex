import Constants from 'expo-constants';
import { Link, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { FEEDBACK_URL, REPOSITORY_URL } from '@/content/legal';
import { useTheme } from '@/hooks/use-theme';

const SOURCES = [
  { name: 'Open Library', url: 'https://openlibrary.org', what: 'book data and covers' },
  { name: 'Rebrickable', url: 'https://rebrickable.com', what: 'LEGO sets and images' },
  { name: 'Wikidata', url: 'https://www.wikidata.org', what: 'book series' },
] as const;

/** Version, data credits, the privacy policy and terms, feedback. Shown signed in or out. */
export function AboutCard() {
  const version = Constants.expoConfig?.version;

  return (
    <Card style={styles.card}>
      <ThemedText type="section">About</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {version ? `Fandex ${version}` : 'Fandex'} · made by a collector, for collectors
      </ThemedText>
      <View style={styles.credits}>
        <ThemedText type="smallBold">Data from</ThemedText>
        {SOURCES.map((source) => (
          <ThemedText key={source.name} type="small" themeColor="textSecondary">
            <TextLink href={source.url} label={source.name} small /> — {source.what}
          </ThemedText>
        ))}
        <ThemedText type="small" themeColor="textSecondary">
          Figure facts are written by Fandex from public sources.
        </ThemedText>
      </View>
      <View style={styles.links}>
        <TextLink href="/privacy" label="Privacy policy" />
        <TextLink href="/terms" label="Terms of use" />
        <TextLink href={FEEDBACK_URL} label="Send feedback" />
        <TextLink href={REPOSITORY_URL} label="Source code on GitHub" />
      </View>
    </Card>
  );
}

/** A link in the accent colour; external ones open in a new tab on the web. */
function TextLink({ href, label, small = false }: { href: Href; label: string; small?: boolean }) {
  const colors = useTheme();
  const external = typeof href === 'string' && href.startsWith('https://');
  return (
    <Link
      href={href}
      target={external ? '_blank' : undefined}
      style={[styles.link, small && styles.small, { color: colors.accent }]}
    >
      {label}
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
  },
  credits: {
    gap: Spacing.one,
  },
  links: {
    gap: Spacing.three,
    alignItems: 'flex-start',
  },
  link: {
    fontFamily: Fonts.semiBold,
    fontSize: 15,
  },
  small: {
    fontSize: 13,
  },
});
