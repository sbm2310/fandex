import { formatTitle, type CatalogEntry, type CollectionItem } from '@fandex/core';
import { Link } from 'expo-router';

import { ThemedText } from './themed-text';

import { useIsInCollection, useOtherEditions } from '@/hooks/use-collection';

/** "You own another edition" under a search result you don't own, linking to your copy. */
export function OtherEditionNote({ entry }: { entry: CatalogEntry }) {
  const inCollection = useIsInCollection(entry);
  const others = useOtherEditions(entry);
  if (inCollection !== false || !others?.[0]) return null;
  return <OwnedEditionLink item={others[0]} count={others.length} text="You own" />;
}

/** "You also own another edition" on an owned item's detail screen. */
export function AlsoOwnedEditions({ entry }: { entry: CatalogEntry }) {
  const others = useOtherEditions(entry);
  if (!others?.[0]) return null;
  return <OwnedEditionLink item={others[0]} count={others.length} text="You also own" />;
}

function OwnedEditionLink({
  item,
  count,
  text,
}: {
  item: CollectionItem;
  count: number;
  text: string;
}) {
  const what = count === 1 ? 'another edition' : `${count} other editions`;
  const year = item.category === 'lego' ? undefined : item.catalog.publishedYear;
  return (
    <Link
      href={{ pathname: '/book/[id]', params: { id: item.id } }}
      accessibilityLabel={`${text} ${what}: ${formatTitle(item.catalog)}${year ? `, ${year}` : ''}`}
    >
      <ThemedText type="small" themeColor="accent">
        {text} {what}
        {count === 1 && year ? ` (${year})` : ''}
      </ThemedText>
    </Link>
  );
}
