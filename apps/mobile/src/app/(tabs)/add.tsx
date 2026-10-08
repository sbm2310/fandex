import type { CatalogEntry } from '@fandex/core';
import { Link, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, View } from 'react-native';

import { AddToCollectionButton } from '@/components/add-to-collection-button';
import { EntryRow } from '@/components/entry-row';
import { OtherEditionNote } from '@/components/other-editions';
import { PageTitle } from '@/components/page-title';
import { Screen } from '@/components/screen';
import { SearchField } from '@/components/search-field';
import { SegmentedControl, type SegmentedOption } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useCatalogSearch, type SearchKind } from '@/hooks/use-catalog-search';
import { useTheme } from '@/hooks/use-theme';
import { catalogErrorMessage } from '@/services/catalog-error-message';

const KIND_OPTIONS: SegmentedOption<SearchKind>[] = [
  { value: 'books', label: 'Books' },
  { value: 'lego', label: 'LEGO' },
];

export default function AddScreen() {
  // The barcode scanner returns here with ?isbn=…&scan=<timestamp>, and a shelf scan's
  // "Search" with ?q=…&kind=…&scan=<timestamp>; `scan` changes every time.
  const params = useLocalSearchParams<{
    isbn?: string;
    q?: string;
    kind?: SearchKind;
    scan?: string;
  }>();
  const incoming = params.isbn ?? params.q;
  const incomingKind: SearchKind = params.kind === 'lego' && !params.isbn ? 'lego' : 'books';
  const [input, setInput] = useState(incoming ?? '');
  const [kind, setKind] = useState<SearchKind>(incomingKind);
  const [appliedScan, setAppliedScan] = useState(params.scan);
  // Put a new scan into the search field (adjusting state during render, as React recommends
  // over an effect: https://react.dev/learn/you-might-not-need-an-effect).
  if (params.scan !== appliedScan) {
    setAppliedScan(params.scan);
    if (incoming) {
      setInput(incoming);
      setKind(incomingKind);
    }
  }
  const search = useCatalogSearch(input, kind);

  return (
    <Screen>
      <PageTitle title="Add to collection" />
      <ThemedText type="subtitle">Add to collection</ThemedText>
      <SegmentedControl
        options={KIND_OPTIONS}
        value={kind}
        onChange={setKind}
        accessibilityLabel="Search for"
      />
      <View style={styles.searchRow}>
        <View style={styles.searchField}>
          <SearchField
            value={input}
            onChangeText={setInput}
            placeholder={kind === 'lego' ? 'Set name or number' : 'Title, author or ISBN'}
            accessibilityLabel={kind === 'lego' ? 'Search LEGO sets' : 'Search books'}
            busy={search.isFetching && !search.isPending}
          />
        </View>
        {/* Book barcodes only: camera scanning is unreliable in browsers, and LEGO box
            barcodes aren't ISBNs. */}
        {Platform.OS !== 'web' && kind === 'books' && <ScanButton />}
      </View>
      {Platform.OS !== 'web' && kind === 'books' && <RapidScanLink />}
      <ShelfScanLink />
      <SearchResults search={search} kind={kind} />
    </Screen>
  );
}

function SearchResults({
  search,
  kind,
}: {
  search: ReturnType<typeof useCatalogSearch>;
  kind: SearchKind;
}) {
  const { mode } = search;

  if (mode.kind === 'idle') {
    return (
      <Message
        text={
          kind === 'lego'
            ? 'Search LEGO sets by name or set number, e.g. "Millennium Falcon" or 75192.'
            : 'Search Open Library by title, author or ISBN.'
        }
      />
    );
  }
  if (mode.kind === 'invalid-isbn') {
    return (
      <Message
        text={`“${mode.input}” isn't a valid ISBN. Check the digits: the last one is a check digit, so a single typo makes it invalid.`}
      />
    );
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
    return (
      <Message
        text={
          mode.kind === 'isbn'
            ? `No book found for ISBN ${mode.isbn}. Open Library doesn't have this edition yet. Try searching by title instead.`
            : mode.kind === 'lego'
              ? `No LEGO sets found for “${mode.query}”.`
              : `No books found for “${mode.query}”.`
        }
      />
    );
  }

  return (
    <FlatList<CatalogEntry>
      data={search.data}
      keyExtractor={(entry) => `${entry.source}:${entry.externalId}`}
      renderItem={({ item }) => (
        <EntryRow
          entry={item}
          accessory={<AddToCollectionButton entry={item} />}
          note={<OtherEditionNote entry={item} />}
        />
      )}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      ListHeaderComponent={
        mode.kind === 'isbn' ? (
          <ThemedText type="small" themeColor="textSecondary">
            Exact match for ISBN {mode.isbn}
          </ThemedText>
        ) : null
      }
      ListFooterComponent={
        <ThemedText type="small" themeColor="textSecondary" style={styles.attribution}>
          {mode.kind === 'lego' ? 'Set data from Rebrickable' : 'Book data from Open Library'}
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

function ScanButton() {
  const colors = useTheme();
  // Link asChild needs a single style object on its child (no arrays or style functions).
  return (
    <Link href="/scan" asChild>
      <Pressable
        accessibilityLabel="Scan a barcode"
        style={StyleSheet.flatten([styles.scanButton, { backgroundColor: colors.accent }])}
      >
        <SymbolView
          name={{ ios: 'barcode.viewfinder', android: 'barcode_scanner', web: 'barcode_scanner' }}
          tintColor={colors.onAccent}
          size={24}
        />
      </Pressable>
    </Link>
  );
}

/** Adding many books at once: scan barcode after barcode (no AI, works for guests). */
function RapidScanLink() {
  const colors = useTheme();
  return (
    <Link href={{ pathname: '/scan', params: { mode: 'rapid' } }} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Scan several books: barcode after barcode, then add them all"
        style={StyleSheet.flatten([styles.shelfLink, { borderColor: colors.border }])}
      >
        <SymbolView
          name={{ ios: 'barcode.viewfinder', android: 'barcode_scanner', web: 'barcode_scanner' }}
          tintColor={colors.accent}
          size={22}
        />
        <View style={styles.searchField}>
          <ThemedText type="smallBold">Scan several books</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Barcode after barcode, then add them all
          </ThemedText>
        </View>
      </Pressable>
    </Link>
  );
}

/** Adding many items at once: photograph a shelf (AI). */
function ShelfScanLink() {
  const colors = useTheme();
  return (
    <Link href="/shelf-scan" asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Scan a shelf: add several items from one photo"
        style={StyleSheet.flatten([styles.shelfLink, { borderColor: colors.border }])}
      >
        <SymbolView
          name={{ ios: 'camera.viewfinder', android: 'photo_camera', web: 'photo_camera' }}
          tintColor={colors.accent}
          size={22}
        />
        <View style={styles.searchField}>
          <ThemedText type="smallBold">Scan a shelf</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Add several items from one photo
          </ThemedText>
        </View>
      </Pressable>
    </Link>
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  searchField: {
    flex: 1,
  },
  scanButton: {
    width: 52,
    height: 52,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shelfLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
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
