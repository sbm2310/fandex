import type { CatalogBook } from '@fandex/core';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { AddBookButton } from '@/components/add-book-button';
import { BookRow } from '@/components/book-row';
import { Screen } from '@/components/screen';
import { SearchField } from '@/components/search-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useBookSearch } from '@/hooks/use-book-search';
import { useTheme } from '@/hooks/use-theme';
import { catalogErrorMessage } from '@/services/catalog-error-message';

export default function AddScreen() {
  const [input, setInput] = useState('');
  const search = useBookSearch(input);

  return (
    <Screen>
      <ThemedText type="subtitle">Add a book</ThemedText>
      <SearchField
        value={input}
        onChangeText={setInput}
        placeholder="Search by title or author"
        accessibilityLabel="Search books"
        busy={search.enabled && search.isFetching && !search.isPending}
      />
      <SearchResults search={search} />
    </Screen>
  );
}

function SearchResults({ search }: { search: ReturnType<typeof useBookSearch> }) {
  if (!search.enabled) {
    return <Message text="Search Open Library's catalog by title or author." />;
  }
  if (search.isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator accessibilityLabel="Searching" />
      </View>
    );
  }
  if (search.isError) {
    return (
      <Message text={catalogErrorMessage(search.error)}>
        <RetryButton onPress={() => void search.refetch()} />
      </Message>
    );
  }
  if (search.data.length === 0) {
    return <Message text={`No books found for “${search.query}”.`} />;
  }

  return (
    <FlatList<CatalogBook>
      data={search.data}
      keyExtractor={(book) => `${book.source}:${book.externalId}`}
      renderItem={({ item }) => <BookRow book={item} accessory={<AddBookButton book={item} />} />}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      ListFooterComponent={
        <ThemedText type="small" themeColor="textSecondary" style={styles.attribution}>
          Book data from Open Library
        </ThemedText>
      }
    />
  );
}

function Message({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <View style={styles.centered}>
      <ThemedText themeColor="textSecondary" style={styles.messageText}>
        {text}
      </ThemedText>
      {children}
    </View>
  );
}

function RetryButton({ onPress }: { onPress: () => void }) {
  const colors = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.retry,
        { borderColor: colors.border },
        pressed && styles.pressed,
      ]}
    >
      <ThemedText type="smallBold">Try again</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  messageText: {
    textAlign: 'center',
  },
  retry: {
    borderWidth: 1,
    borderRadius: Spacing.four,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  pressed: {
    opacity: 0.7,
  },
  attribution: {
    textAlign: 'center',
    paddingVertical: Spacing.four,
  },
});
