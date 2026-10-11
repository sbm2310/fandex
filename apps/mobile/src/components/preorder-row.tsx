import { formatRelease, type PreorderResponse } from '@fandex/core';
import { Link } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { EntryRow } from './entry-row';
import { ThemedText } from './themed-text';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { toCatalogEntry } from '@/services/catalog-mapping';

const STATUS: Record<PreorderResponse['status'], string> = {
  ordered: 'On order',
  arrived: 'Arrived',
  cancelled: 'Cancelled',
};

type Props = {
  preorder: PreorderResponse;
  /** What needs doing ("Balance of $280.00 due October 18, 2026"), shown under the item. */
  notes?: readonly string[];
};

/** A pre-order in a list: the item, its status and expected date; opens its page. */
export function PreorderRow({ preorder, notes = [] }: Props) {
  const colors = useTheme();
  const entry = toCatalogEntry(preorder.catalog);
  const when = preorder.expectedRelease
    ? `expected ${formatRelease(preorder.expectedRelease)}`
    : 'no date yet';
  // An expected date only matters while it's still on order.
  const summary =
    preorder.status === 'ordered' ? `${STATUS.ordered}, ${when}` : STATUS[preorder.status];
  return (
    <Link href={{ pathname: '/preorder/[id]', params: { id: preorder.id } }} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={[`${preorder.catalog.title}: ${summary}`, ...notes].join('. ')}
        style={styles.row}
      >
        {entry ? <EntryRow entry={entry} showUniverses={false} /> : null}
        <ThemedText type="small" themeColor="textSecondary" style={styles.meta}>
          {summary}
        </ThemedText>
        {notes.map((note) => (
          <ThemedText key={note} type="smallBold" style={[styles.meta, { color: colors.accent }]}>
            {note}
          </ThemedText>
        ))}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: Spacing.two },
  meta: { paddingLeft: 48 + Spacing.three },
});
