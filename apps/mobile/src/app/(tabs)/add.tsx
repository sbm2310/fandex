import type { CatalogEntry, NewFigure } from '@fandex/core';
import { Link, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, View } from 'react-native';

import { AddFigureForm } from '@/components/add-figure-form';
import { AddToCollectionButton } from '@/components/add-to-collection-button';
import { cardStyle } from '@/components/card';
import { CategoryButtons, type CategoryButtonOption } from '@/components/category-buttons';
import { EntryRow } from '@/components/entry-row';
import { OtherEditionNote } from '@/components/other-editions';
import { PageTitle } from '@/components/page-title';
import { PreorderLink } from '@/components/preorder-link';
import { Screen } from '@/components/screen';
import { SearchField } from '@/components/search-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useCatalogSearch, type SearchKind } from '@/hooks/use-catalog-search';
import { useTheme } from '@/hooks/use-theme';
import { catalogErrorMessage } from '@/services/catalog-error-message';

const KIND_OPTIONS: CategoryButtonOption<SearchKind>[] = [
  {
    value: 'books',
    label: 'Books',
    icon: { ios: 'book.closed', android: 'menu_book', web: 'menu_book' },
  },
  {
    value: 'lego',
    label: 'LEGO',
    icon: { ios: 'square.stack.3d.up', android: 'stacks', web: 'stacks' },
  },
  {
    value: 'figures',
    label: 'Figures',
    icon: { ios: 'figure.stand', android: 'person', web: 'person' },
  },
];

const PLACEHOLDERS: Record<SearchKind, string> = {
  books: 'Title, author or ISBN',
  lego: 'Set name or number',
  figures: 'Name or box number',
};

const SEARCH_LABELS: Record<SearchKind, string> = {
  books: 'Search books',
  lego: 'Search LEGO sets',
  figures: 'Search figures',
};

export default function AddScreen() {
  // The barcode scanner returns here with ?isbn=…&scan=<timestamp>, a shelf scan's "Search"
  // with ?q=…&kind=…&scan=<timestamp>, and a box scan's "Add it by hand" with
  // ?kind=figures&byHand=1&title=…&scan=<timestamp>; `scan` changes every time.
  const params = useLocalSearchParams<{
    isbn?: string;
    q?: string;
    kind?: SearchKind;
    scan?: string;
    byHand?: string;
    title?: string;
    brand?: string;
    number?: string;
    edition?: string;
    line?: string;
    scale?: string;
  }>();
  const incoming = params.isbn ?? params.q;
  const incomingKind: SearchKind =
    (params.kind === 'lego' || params.kind === 'figures') && !params.isbn ? params.kind : 'books';
  const [input, setInput] = useState(incoming ?? '');
  const [kind, setKind] = useState<SearchKind>(incomingKind);
  // Figures not in Fandex's catalog are described by hand instead.
  const [byHand, setByHand] = useState(params.byHand === '1');
  // What the add-by-hand form starts with: the search text, or what a box scan read.
  const [prefill, setPrefill] = useState<Partial<NewFigure> | null>(() => scannedFigure(params));
  const [appliedScan, setAppliedScan] = useState(params.scan);
  // Put a new scan into the search field (adjusting state during render, as React recommends
  // over an effect: https://react.dev/learn/you-might-not-need-an-effect).
  if (params.scan !== appliedScan) {
    setAppliedScan(params.scan);
    if (incoming) {
      setInput(incoming);
      setKind(incomingKind);
      setByHand(false);
    } else if (params.byHand === '1') {
      setKind('figures');
      setByHand(true);
      setPrefill(scannedFigure(params));
    }
  }
  const search = useCatalogSearch(byHand ? '' : input, kind);
  const changeKind = (next: SearchKind) => {
    setKind(next);
    setByHand(false);
    setPrefill(null);
  };

  return (
    <Screen>
      <PageTitle title="Add to collection" />
      <ThemedText type="subtitle">Add to collection</ThemedText>
      <CategoryButtons
        options={KIND_OPTIONS}
        value={kind}
        onChange={changeKind}
        accessibilityLabel="What to add"
      />
      {kind === 'figures' && byHand ? (
        <AddFigureForm
          // A new scan starts a fresh form.
          key={appliedScan ?? 'search'}
          initial={prefill ?? { title: input.trim() }}
          onBack={() => {
            setByHand(false);
            setPrefill(null);
          }}
        />
      ) : (
        <>
          <View style={styles.searchRow}>
            <View style={styles.searchField}>
              <SearchField
                value={input}
                onChangeText={setInput}
                placeholder={PLACEHOLDERS[kind]}
                accessibilityLabel={SEARCH_LABELS[kind]}
                busy={search.isFetching && !search.isPending}
              />
            </View>
            {/* Book barcodes (not on the web: camera scanning is unreliable in browsers) and
            figure boxes. LEGO box barcodes aren't ISBNs, so LEGO has none. */}
            {Platform.OS !== 'web' && kind === 'books' && <ScanButton />}
            {kind === 'figures' && <BoxScanButton />}
          </View>
          {Platform.OS !== 'web' && kind === 'books' && <RapidScanLink />}
          {/* Shelf photos find books and LEGO sets; a figure's box is scanned on its own. */}
          {kind !== 'figures' && <ShelfScanLink />}
          <SearchResults search={search} kind={kind} onAddByHand={() => setByHand(true)} />
        </>
      )}
    </Screen>
  );
}

const IDLE_MESSAGES: Record<SearchKind, string> = {
  books: 'Search Open Library by title, author or ISBN.',
  lego: 'Search LEGO sets by name or set number, e.g. "Millennium Falcon" or 75192.',
  figures:
    'Search Hot Toys and InArt figures by name, character or box number, e.g. "Gandalf" or MMS 279.',
};

function SearchResults({
  search,
  kind,
  onAddByHand,
}: {
  search: ReturnType<typeof useCatalogSearch>;
  kind: SearchKind;
  /** Figures only: describe one the catalog doesn't have. */
  onAddByHand: () => void;
}) {
  const { mode } = search;
  const byHand = kind === 'figures' ? <AddByHandButton onPress={onAddByHand} /> : null;

  if (mode.kind === 'idle') {
    return <Message text={IDLE_MESSAGES[kind]}>{byHand}</Message>;
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
              : mode.kind === 'figures'
                ? `No figures found for “${mode.query}” in Fandex's catalog.`
                : `No books found for “${mode.query}”.`
        }
      >
        {byHand}
      </Message>
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
          note={
            <View style={styles.notes}>
              <OtherEditionNote entry={item} />
              <PreorderLink entry={item} />
            </View>
          }
        />
      )}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      // The indicator sat over the buttons' right edge ("✓ Owned") on the web.
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        mode.kind === 'isbn' ? (
          <ThemedText type="small" themeColor="textSecondary">
            Exact match for ISBN {mode.isbn}
          </ThemedText>
        ) : null
      }
      ListFooterComponent={
        <View style={styles.footer}>
          {byHand}
          <ThemedText type="small" themeColor="textSecondary" style={styles.attribution}>
            {mode.kind === 'lego'
              ? 'Set data from Rebrickable'
              : mode.kind === 'figures'
                ? "Figures from Fandex's own catalog"
                : 'Book data from Open Library'}
          </ThemedText>
        </View>
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
        style={StyleSheet.flatten([cardStyle(colors), styles.shelfLink])}
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

/** A figure from its box: photograph it, the AI reads it and Fandex finds it (AI). */
function BoxScanButton() {
  const colors = useTheme();
  return (
    <Link href="/figure-scan" asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Scan a box: find a figure from a photo of its box"
        style={StyleSheet.flatten([styles.scanButton, { backgroundColor: colors.accent }])}
      >
        <SymbolView
          name={{ ios: 'camera.viewfinder', android: 'photo_camera', web: 'photo_camera' }}
          tintColor={colors.onAccent}
          size={24}
        />
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
        style={StyleSheet.flatten([cardStyle(colors), styles.shelfLink])}
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

/** A figure Fandex's catalog doesn't have: describe it instead. */
function AddByHandButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.byHand}>
      <ThemedText type="small" themeColor="accent">
        Not here? Add it by hand
      </ThemedText>
    </Pressable>
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
  notes: {
    gap: Spacing.one,
  },
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
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shelfLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
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
  footer: {
    alignItems: 'center',
    paddingTop: Spacing.three,
  },
  byHand: {
    paddingVertical: Spacing.two,
  },
  attribution: {
    textAlign: 'center',
    paddingVertical: Spacing.four,
  },
});

/** The figure a box scan sent ("Add it by hand"), or null when the Add tab was opened otherwise. */
function scannedFigure(params: {
  byHand?: string;
  title?: string;
  brand?: string;
  number?: string;
  edition?: string;
  line?: string;
  scale?: string;
}): Partial<NewFigure> | null {
  if (params.byHand !== '1') return null;
  const { title, brand, number, edition, line, scale } = params;
  return {
    ...(title && { title }),
    ...(brand && { brand }),
    ...(number && { number }),
    ...(edition && { edition }),
    ...(line && { line }),
    ...(scale && { scale }),
  };
}
