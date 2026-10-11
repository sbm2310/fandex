import { isBookEntry, releasePeriodEnd, type CatalogEntry } from '@fandex/core';
import { Link } from 'expo-router';

import { ThemedText } from './themed-text';

import { useIsInCollection } from '@/hooks/use-collection';
import { localToday } from '@/utils/today';

/** "Pre-order" under a search result that isn't owned yet (needs a Fandex catalog id). */
export function PreorderLink({ entry }: { entry: CatalogEntry }) {
  const owned = useIsInCollection(entry);
  if (owned !== false || !entry.catalogId) return null;
  // An upcoming book's release date, from Open Library, to start the form with.
  const upcoming =
    isBookEntry(entry) && entry.publishDate && releasePeriodEnd(entry.publishDate) >= localToday()
      ? entry.publishDate
      : undefined;
  return (
    <Link
      href={{
        pathname: '/preorder/new',
        params: {
          catalogId: entry.catalogId,
          title: entry.title,
          ...(upcoming && { release: upcoming.date, releasePrecision: upcoming.precision }),
        },
      }}
      accessibilityLabel={`Pre-order ${entry.title}`}
    >
      <ThemedText type="small" themeColor="accent">
        Pre-order
      </ThemedText>
    </Link>
  );
}
