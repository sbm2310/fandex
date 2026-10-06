import { formatTitle, type CatalogEntry } from '@fandex/core';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { BookCover } from './book-cover';
import { CategoryBadge, categoryForLabel } from './category-badge';
import { ThemedText } from './themed-text';
import { UniverseChips } from './universe-links';

import { Spacing } from '@/constants/theme';

type Props = {
  entry: CatalogEntry;
  /** Optional trailing control, e.g. an Add button. Kept outside the grouped label so it stays focusable. */
  accessory?: ReactNode;
  /** Optional line under the row, e.g. "You own another edition" (also its own focusable element). */
  note?: ReactNode;
};

/** The two secondary lines for a result: authors + year/publisher, or set number/pieces + theme/year. */
export function entryDetails(entry: CatalogEntry): [string | undefined, string | undefined] {
  if (entry.category === 'lego') {
    const pieces = entry.pieceCount && `${entry.pieceCount.toLocaleString('en-US')} pieces`;
    return [
      [entry.setNumber, pieces].filter(Boolean).join(' · ') || undefined,
      [entry.theme, entry.year].filter(Boolean).join(' · ') || undefined,
    ];
  }
  return [
    entry.authors.join(', ') || undefined,
    [entry.publishedYear, entry.publisher].filter(Boolean).join(' · ') || undefined,
  ];
}

/** One search result: image, title, and two lines of details (books or LEGO sets). */
export function EntryRow({ entry, accessory, note }: Props) {
  const title = formatTitle(entry);
  const [first, second] = entryDetails(entry);
  const isSet = entry.category === 'lego';
  const label = [
    title,
    categoryForLabel(entry.category),
    first && (isSet ? `set ${first}` : `by ${first}`),
    second,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <View style={styles.entry}>
      <View style={styles.row}>
        <View style={styles.info} accessible accessibilityLabel={label}>
          <BookCover
            coverUrl={entry.coverUrl}
            title={entry.title}
            width={COVER_WIDTH}
            fit={isSet ? 'contain' : 'cover'}
            aspectRatio={isSet ? 1 : 1.5}
          />
          <View style={styles.text}>
            <CategoryBadge category={entry.category} />
            <ThemedText type="smallBold" numberOfLines={2}>
              {title}
            </ThemedText>
            {first ? (
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {first}
              </ThemedText>
            ) : null}
            {second ? (
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {second}
              </ThemedText>
            ) : null}
          </View>
        </View>
        {accessory}
      </View>
      {/* Outside the grouped label so each link is reachable on its own. */}
      {note ? <View style={styles.indented}>{note}</View> : null}
      {entry.universes?.length ? (
        <View style={styles.indented}>
          <UniverseChips universes={entry.universes} />
        </View>
      ) : null}
    </View>
  );
}

const COVER_WIDTH = 48;

const styles = StyleSheet.create({
  entry: {
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  indented: {
    // Lines up with the title, past the cover.
    paddingLeft: COVER_WIDTH + Spacing.three,
  },
  info: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.three,
  },
  text: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.half,
  },
});
