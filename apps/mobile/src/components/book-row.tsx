import type { CatalogBook } from '@fandex/core';
import { StyleSheet, View } from 'react-native';

import { BookCover } from './book-cover';
import { ThemedText } from './themed-text';

import { Spacing } from '@/constants/theme';

/** One search result: cover thumbnail, title, authors, and year/publisher. */
export function BookRow({ book }: { book: CatalogBook }) {
  const authors = book.authors.join(', ');
  const details = [book.publishedYear, book.publisher].filter(Boolean).join(' · ');

  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={[book.title, authors && `by ${authors}`, details]
        .filter(Boolean)
        .join(', ')}
    >
      <BookCover coverUrl={book.coverUrl} title={book.title} width={48} />
      <View style={styles.text}>
        <ThemedText type="smallBold" numberOfLines={2}>
          {book.title}
          {book.subtitle ? `: ${book.subtitle}` : ''}
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
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  text: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.half,
  },
});
