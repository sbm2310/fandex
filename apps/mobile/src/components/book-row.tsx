import { formatTitle, type CatalogBook } from '@fandex/core';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { BookCover } from './book-cover';
import { ThemedText } from './themed-text';

import { Spacing } from '@/constants/theme';

type Props = {
  book: CatalogBook;
  /** Optional trailing control, e.g. an Add button. Kept outside the grouped label so it stays focusable. */
  accessory?: ReactNode;
};

/** One search result: cover thumbnail, title, authors, and year/publisher. */
export function BookRow({ book, accessory }: Props) {
  const title = formatTitle(book);
  const authors = book.authors.join(', ');
  const details = [book.publishedYear, book.publisher].filter(Boolean).join(' · ');

  return (
    <View style={styles.row}>
      <View
        style={styles.info}
        accessible
        accessibilityLabel={[title, authors && `by ${authors}`, details].filter(Boolean).join(', ')}
      >
        <BookCover coverUrl={book.coverUrl} title={book.title} width={48} />
        <View style={styles.text}>
          <ThemedText type="smallBold" numberOfLines={2}>
            {title}
          </ThemedText>
          {authors ? (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {authors}
            </ThemedText>
          ) : null}
          {details ? (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {details}
            </ThemedText>
          ) : null}
        </View>
      </View>
      {accessory}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
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
