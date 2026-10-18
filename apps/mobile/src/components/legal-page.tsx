import { ScrollView, StyleSheet, View } from 'react-native';

import { PageTitle } from '@/components/page-title';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import type { LegalDocument } from '@/content/legal';

/** A plain text page: the privacy policy or the terms. Readable signed out. */
export function LegalPage({ document }: { document: LegalDocument }) {
  return (
    <ThemedView style={styles.fill}>
      <PageTitle title={document.title} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <ThemedText type="subtitle" accessibilityRole="header">
            {document.title}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Last updated {document.updated}
          </ThemedText>
        </View>
        <ThemedText>{document.intro}</ThemedText>
        {document.sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <ThemedText type="section" accessibilityRole="header">
              {section.heading}
            </ThemedText>
            {section.paragraphs.map((paragraph) => (
              <ThemedText key={paragraph}>{paragraph}</ThemedText>
            ))}
          </View>
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    gap: Spacing.four,
  },
  header: {
    gap: Spacing.one,
  },
  section: {
    gap: Spacing.two,
  },
});
