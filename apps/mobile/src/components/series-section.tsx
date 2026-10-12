import {
  formatRelease,
  formatVolumeRanges,
  isUpcoming,
  type CollectionItem,
  type SeriesEntry,
} from '@fandex/core';
import { Link } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AddToCollectionButton } from './add-to-collection-button';
import { EntryRow } from './entry-row';
import { PreorderLink } from './preorder-link';
import { ThemedText } from './themed-text';

import { Spacing } from '@/constants/theme';
import { MISSING_LOOKUPS, useBookSeries, useVolumeSeries } from '@/hooks/use-series';
import { localToday } from '@/utils/today';

/**
 * "You're missing…" on an item's page: its place in a book series (Wikidata) or a manga/comic
 * series (volume numbers), what's missing, and what's next — each to add or pre-order.
 */
export function SeriesSection({ item }: { item: CollectionItem }) {
  if (item.category === 'book') return <BookSeriesSection item={item} />;
  if (item.category === 'manga' || item.category === 'comic') {
    return <VolumeSeriesSection item={item} />;
  }
  return null;
}

function BookSeriesSection({ item }: { item: CollectionItem }) {
  const { progress, editionFor } = useBookSeries(item);
  // Nothing until the series is known: no placeholder that may turn out to be nothing.
  if (!progress) return null;
  const { series, owned, missing } = progress;
  const workKey = 'workKey' in item.catalog ? item.catalog.workKey : undefined;
  const place = series.entries.find((entry) => entry.workKey === workKey)?.ordinal;
  const total = series.entries.length;

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" accessibilityRole="header">
        {place ? `Book ${place} of ${total} in ${series.name}` : `Part of ${series.name}`}
      </ThemedText>
      {missing.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          You have all {total} books.
        </ThemedText>
      ) : (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            You have {owned.length} of {total}. You&apos;re missing:
          </ThemedText>
          {missing.slice(0, MISSING_LOOKUPS).map((entry) => (
            <MissingBook key={entry.wikidataId} entry={entry} edition={editionFor(entry)} />
          ))}
          {missing.length > MISSING_LOOKUPS ? (
            <ThemedText type="small" themeColor="textSecondary">
              …and {missing.length - MISSING_LOOKUPS} more.
            </ThemedText>
          ) : null}
        </>
      )}
    </View>
  );
}

type Edition = ReturnType<ReturnType<typeof useBookSeries>['editionFor']>;

function MissingBook({ entry, edition }: { entry: SeriesEntry; edition: Edition }) {
  const when = entry.published
    ? isUpcoming(entry, localToday())
      ? `Out ${formatRelease({ date: entry.published, precision: 'day' })}`
      : entry.published.slice(0, 4)
    : undefined;
  const label = [`Book ${entry.ordinal}`, when].filter(Boolean).join(' · ');

  if (edition?.data) {
    return (
      <EntryRow
        entry={edition.data}
        showUniverses={false}
        accessory={<AddToCollectionButton entry={edition.data} />}
        note={
          <View style={styles.note}>
            <ThemedText type="small" themeColor="textSecondary">
              {label}
            </ThemedText>
            <PreorderLink entry={edition.data} />
          </View>
        }
      />
    );
  }
  // Still looking it up, or no edition to offer: the title, and a search instead.
  return (
    <View style={styles.plain}>
      <View style={styles.plainText}>
        <ThemedText>{entry.title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
      </View>
      {edition?.isPending ? (
        <ActivityIndicator accessibilityLabel={`Looking up ${entry.title}`} />
      ) : (
        <SearchLink query={entry.title} label={`Search for ${entry.title}`} />
      )}
    </View>
  );
}

function VolumeSeriesSection({ item }: { item: CollectionItem }) {
  const { series, volume, next } = useVolumeSeries(item);
  if (!series || volume === undefined) return null;
  const today = localToday();

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" accessibilityRole="header">
        Volume {volume} of {series.name}
      </ThemedText>
      {series.missing.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          You have volumes {formatVolumeRanges(series.owned)}.
        </ThemedText>
      ) : (
        <View style={styles.missing}>
          <ThemedText type="small" themeColor="textSecondary">
            You have {series.owned.length} of {series.highest}. You&apos;re missing{' '}
            {series.missing.length === 1 ? 'volume' : 'volumes'}{' '}
            {formatVolumeRanges(series.missing)}.
          </ThemedText>
          <SearchLink query={series.name} label={`Search for ${series.name}`} />
        </View>
      )}
      {next ? (
        <EntryRow
          entry={next.entry}
          showUniverses={false}
          accessory={<AddToCollectionButton entry={next.entry} />}
          note={
            <View style={styles.note}>
              <ThemedText type="small" themeColor="textSecondary">
                {next.entry.publishDate &&
                next.entry.publishDate.date > today &&
                next.entry.publishDate.precision !== 'year'
                  ? `Next: volume ${next.volume}, out ${formatRelease(next.entry.publishDate)}`
                  : `Next: volume ${next.volume}`}
              </ThemedText>
              <PreorderLink entry={next.entry} />
            </View>
          }
        />
      ) : null}
    </View>
  );
}

function SearchLink({ query, label }: { query: string; label: string }) {
  return (
    <Link href={{ pathname: '/add', params: { q: query } }} accessibilityLabel={label}>
      <ThemedText type="small" themeColor="accent">
        Search
      </ThemedText>
    </Link>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  missing: {
    gap: Spacing.one,
  },
  note: {
    gap: Spacing.one,
  },
  plain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  plainText: {
    flex: 1,
  },
});
