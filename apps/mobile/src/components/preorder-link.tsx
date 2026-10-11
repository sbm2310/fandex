import type { CatalogEntry } from '@fandex/core';
import { Link } from 'expo-router';

import { ThemedText } from './themed-text';

import { useIsInCollection } from '@/hooks/use-collection';

/** "Pre-order" under a search result that isn't owned yet (needs a Fandex catalog id). */
export function PreorderLink({ entry }: { entry: CatalogEntry }) {
  const owned = useIsInCollection(entry);
  if (owned !== false || !entry.catalogId) return null;
  return (
    <Link
      href={{
        pathname: '/preorder/new',
        params: { catalogId: entry.catalogId, title: entry.title },
      }}
      accessibilityLabel={`Pre-order ${entry.title}`}
    >
      <ThemedText type="small" themeColor="accent">
        Pre-order
      </ThemedText>
    </Link>
  );
}
