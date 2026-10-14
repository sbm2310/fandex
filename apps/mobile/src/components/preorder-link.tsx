import { isBookEntry, releasePeriodEnd, type CatalogEntry } from '@fandex/core';
import { Link } from 'expo-router';

import { ThemedText } from './themed-text';

import { useIsInCollection } from '@/hooks/use-collection';
import { localToday } from '@/utils/today';

/** "Pre-order" under a search result that isn't owned yet (needs a Fandex catalog id). */
export function PreorderLink({ entry }: { entry: CatalogEntry }) {
  const owned = useIsInCollection(entry);
  if (owned !== false || !entry.catalogId) return null;
  // An upcoming release date to start the form with: Open Library's for a book, the figure
  // catalog's for a figure.
  const catalogDate = isBookEntry(entry)
    ? entry.publishDate
    : entry.category === 'figure'
      ? entry.release
      : undefined;
  const upcoming =
    catalogDate && releasePeriodEnd(catalogDate) >= localToday() ? catalogDate : undefined;
  return (
    <Link
      href={{
        pathname: '/preorder/new',
        params: {
          catalogId: entry.catalogId,
          title: entry.title,
          ...(upcoming && { release: upcoming.date, releasePrecision: upcoming.precision }),
          ...(upcoming && entry.category === 'figure' && { releaseFrom: 'fandex' }),
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
