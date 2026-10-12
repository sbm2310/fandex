import { formatRelease, formatVolumeRanges } from '@fandex/core';
import { Link } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { PageTitle } from '@/components/page-title';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useSeriesOverview, type SeriesSummary } from '@/hooks/use-series';
import { useTheme } from '@/hooks/use-theme';
import { localToday } from '@/utils/today';

const KIND_LABELS: Record<SeriesSummary['kind'], string> = {
  book: 'Books',
  manga: 'Manga',
  comic: 'Comics',
};

/** Every series you have something of: what's missing and what's next, incomplete ones first. */
export default function SeriesScreen() {
  const { summaries, isPending, bookSeriesFailed, retry } = useSeriesOverview();

  if (isPending) {
    return (
      <ThemedView style={[styles.fill, styles.centered]}>
        <PageTitle title="Your series" />
        <ActivityIndicator accessibilityLabel="Loading your series" />
      </ThemedView>
    );
  }

  const incomplete = summaries.filter((summary) => summary.missing.length > 0);
  const failure = bookSeriesFailed ? (
    <View style={styles.failure}>
      <ThemedText type="small" themeColor="textSecondary" accessibilityRole="alert">
        Couldn&apos;t load your book series. Manga and comics are listed from your collection.
      </ThemedText>
      <Button label="Try again" variant="secondary" onPress={retry} />
    </View>
  ) : null;

  if (summaries.length === 0) {
    return (
      <ThemedView style={styles.fill}>
        <PageTitle title="Your series" />
        {failure}
        <EmptyState
          title="No series yet"
          message="Books from a series, and numbered manga and comic volumes, show up here with what you're missing."
          action={{ label: 'Go to Add', href: '/add' }}
        />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.fill}>
      <PageTitle title="Your series" />
      <FlatList
        data={summaries}
        keyExtractor={(summary) => summary.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <ThemedText type="subtitle" accessibilityRole="header">
              Your series
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              {incomplete.length === 0
                ? `${summaries.length === 1 ? 'Your series is' : `All ${summaries.length} series are`} complete.`
                : `${incomplete.length} of ${summaries.length} have something missing.`}
            </ThemedText>
            {failure}
          </View>
        }
        renderItem={({ item }) => <SeriesRow summary={item} />}
      />
    </ThemedView>
  );
}

function SeriesRow({ summary }: { summary: SeriesSummary }) {
  const colors = useTheme();
  const unit = (count: number) =>
    summary.kind === 'book' ? (count === 1 ? 'book' : 'books') : count === 1 ? 'volume' : 'volumes';
  const have = `You have ${summary.owned} of ${summary.total} ${unit(summary.total)}`;
  const missing =
    summary.missing.length === 0
      ? 'Complete'
      : `Missing ${unit(summary.missing.length)} ${formatVolumeRanges(summary.missing)}`;
  const next = summary.next
    ? summary.next.publishDate &&
      summary.next.publishDate.date > localToday() &&
      summary.next.publishDate.precision !== 'year'
      ? `Next: volume ${summary.next.volume}, out ${formatRelease(summary.next.publishDate)}`
      : `Next: volume ${summary.next.volume} is out`
    : undefined;
  const lines = [have, missing, next].filter(Boolean) as string[];

  // Link asChild needs a single style object on its child (no arrays or style functions).
  return (
    <Link href={{ pathname: '/book/[id]', params: { id: summary.itemId } }} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={[`${summary.name}, ${KIND_LABELS[summary.kind]}`, ...lines].join('. ')}
        style={StyleSheet.flatten([styles.row, { borderColor: colors.border }])}
      >
        <View style={styles.rowTitle}>
          <ThemedText type="smallBold" style={styles.name}>
            {summary.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {KIND_LABELS[summary.kind]}
          </ThemedText>
        </View>
        {lines.map((line) => (
          <ThemedText
            key={line}
            type="small"
            themeColor={line === missing && summary.missing.length > 0 ? 'accent' : 'textSecondary'}
          >
            {line}
          </ThemedText>
        ))}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    gap: Spacing.two,
  },
  header: {
    gap: Spacing.one,
    marginBottom: Spacing.two,
  },
  failure: {
    gap: Spacing.two,
    marginVertical: Spacing.two,
  },
  row: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.three,
    gap: Spacing.one,
  },
  rowTitle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  name: {
    flex: 1,
  },
});
