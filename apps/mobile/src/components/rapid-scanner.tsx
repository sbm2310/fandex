import { formatTitle, isBookBarcode, parseIsbn, type Isbn13 } from '@fandex/core';
import { useQueryClient } from '@tanstack/react-query';
import { CameraView, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from './button';
import { EntryRow } from './entry-row';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { Spacing } from '@/constants/theme';
import { useAddToCollection, useCollection } from '@/hooks/use-collection';
import { useTheme } from '@/hooks/use-theme';
import { useCatalog } from '@/services/app-services';
import { confirm } from '@/utils/confirm';
import {
  addScan,
  booksToAdd,
  isOwned,
  removeScan,
  retryScan,
  settleScan,
  type LookupResult,
  type ScannedBook,
} from '@/utils/rapid-scan';

const HINT_MS = 2000;

/**
 * Scans book after book without leaving the camera: each ISBN is looked up as it's read and
 * listed below the camera (owned books marked), then "Add N books" saves them all. No AI, so
 * it works for guests too.
 */
export function RapidScanner() {
  const colors = useTheme();
  const catalog = useCatalog();
  const queryClient = useQueryClient();
  const { data: owned = [] } = useCollection();
  const add = useAddToCollection();
  const [list, setList] = useState<ScannedBook[]>([]);
  // The camera calls back many times a second, faster than state updates: the ref is the
  // list as of the latest read.
  const latest = useRef<ScannedBook[]>([]);
  const [hint, setHint] = useState<{ text: string; at: number } | null>(null);
  const [progress, setProgress] = useState<{ done: number; failed: number } | null>(null);
  const [added, setAdded] = useState<number | null>(null);

  const update = (change: (list: ScannedBook[]) => ScannedBook[]) => {
    latest.current = change(latest.current);
    setList(latest.current);
  };
  const showHint = (text: string) => {
    const at = Date.now();
    setHint({ text, at });
    setTimeout(() => setHint((current) => (current?.at === at ? null : current)), HINT_MS);
  };

  const lookUp = (isbn: Isbn13) => {
    // Shares the Add screen's cache: a book looked up there (or scanned again) isn't re-fetched.
    queryClient
      .fetchQuery({
        queryKey: ['catalog', 'isbn', isbn],
        queryFn: ({ signal }) => catalog.lookupIsbn(isbn, { signal }),
      })
      .then(
        (book): LookupResult => ({ book }),
        (error: unknown): LookupResult => ({ error }),
      )
      .then((result) => update((current) => settleScan(current, isbn, result)));
  };

  function onBarcodeScanned({ data }: BarcodeScanningResult) {
    const isbn = isBookBarcode(data) ? parseIsbn(data) : null;
    if (!isbn) return showHint("That's not a book barcode");
    const next = addScan(latest.current, isbn);
    if (!next) return showHint('Already scanned. Next book!');
    update(() => next);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    lookUp(isbn);
  }

  const toAdd = booksToAdd(list, owned);
  const lookingUp = list.some((scanned) => scanned.status === 'looking-up');

  const addAll = async () => {
    let done = 0;
    let failed = 0;
    setProgress({ done, failed });
    // One at a time, as the shelf scan does: no flood of parallel writes.
    for (const book of toAdd) {
      try {
        await add.mutateAsync(book);
        done += 1;
      } catch {
        failed += 1;
      }
      setProgress({ done, failed });
    }
    if (failed === 0) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAdded(done);
    }
  };

  const close = async () => {
    const unsaved = booksToAdd(latest.current, owned).length;
    if (
      unsaved > 0 &&
      added === null &&
      !(await confirm({
        title: 'Discard scanned books?',
        message:
          unsaved === 1
            ? "1 book hasn't been added yet."
            : `${unsaved} books haven't been added yet.`,
        confirmLabel: 'Discard',
        destructive: true,
      }))
    ) {
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace('/add');
  };

  if (added !== null) {
    return (
      <ThemedView style={styles.fill}>
        <SafeAreaView style={styles.done}>
          <ThemedText type="subtitle" accessibilityRole="header" style={styles.centered}>
            {added === 1 ? 'Added 1 book' : `Added ${added} books`}
          </ThemedText>
          <Button label="See your collection" onPress={() => router.dismissTo('/')} />
          <Button
            label="Scan more books"
            variant="secondary"
            onPress={() => {
              update(() => []);
              setProgress(null);
              setAdded(null);
            }}
          />
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <View style={styles.fill}>
      <View style={styles.camera}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['ean13'] }}
          onBarcodeScanned={onBarcodeScanned}
        />
        <SafeAreaView edges={['top']} style={styles.overlay} pointerEvents="box-none">
          <View style={styles.hintBox} accessibilityLiveRegion="polite">
            <ThemedText type="smallBold" style={styles.lightText}>
              {hint?.text ?? 'Scan books one after another'}
            </ThemedText>
          </View>
          <View style={styles.frame} accessibilityElementsHidden importantForAccessibility="no" />
        </SafeAreaView>
      </View>

      <ThemedView style={styles.panel}>
        <SafeAreaView edges={['bottom']} style={styles.fill}>
          <FlatList
            data={list}
            keyExtractor={(scanned) => scanned.isbn}
            ListHeaderComponent={
              <ThemedText type="smallBold" accessibilityRole="header" style={styles.listHeader}>
                {list.length === 0
                  ? 'Scanned books appear here'
                  : list.length === 1
                    ? '1 book scanned'
                    : `${list.length} books scanned`}
              </ThemedText>
            }
            renderItem={({ item }) => (
              <ScannedRow
                scanned={item}
                owned={item.status === 'found' && isOwned(item.book, owned)}
                onRemove={() => update((current) => removeScan(current, item.isbn))}
                onRetry={() => {
                  update((current) => retryScan(current, item.isbn));
                  lookUp(item.isbn);
                }}
              />
            )}
            contentContainerStyle={styles.list}
          />
          <View style={[styles.footer, { borderColor: colors.border }]}>
            {progress && progress.failed > 0 ? (
              <ThemedText type="smallBold" accessibilityRole="alert">
                {progress.failed === 1
                  ? "1 book couldn't be added. Try again."
                  : `${progress.failed} books couldn't be added. Try again.`}
              </ThemedText>
            ) : null}
            <Button
              label={
                progress && add.isPending
                  ? `Adding ${progress.done + progress.failed + 1} of ${toAdd.length}…`
                  : lookingUp
                    ? 'Looking up…'
                    : toAdd.length === 1
                      ? 'Add 1 book'
                      : `Add ${toAdd.length} books`
              }
              busy={add.isPending}
              disabled={toAdd.length === 0 || lookingUp}
              onPress={() => void addAll()}
            />
            <Button label="Done" variant="secondary" onPress={() => void close()} />
          </View>
        </SafeAreaView>
      </ThemedView>
    </View>
  );
}

function ScannedRow({
  scanned,
  owned,
  onRemove,
  onRetry,
}: {
  scanned: ScannedBook;
  owned: boolean;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const colors = useTheme();
  const name = scanned.status === 'found' ? formatTitle(scanned.book) : `ISBN ${scanned.isbn}`;
  const remove = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Remove ${name}`}
      onPress={onRemove}
      hitSlop={8}
      style={({ pressed }) => [styles.remove, pressed && styles.pressed]}
    >
      <ThemedText type="smallBold" themeColor="textSecondary">
        ✕
      </ThemedText>
    </Pressable>
  );

  return (
    <View style={[styles.row, { borderColor: colors.border }]}>
      {scanned.status === 'found' ? (
        <EntryRow
          entry={scanned.book}
          accessory={
            owned ? (
              <View
                style={styles.owned}
                accessible
                accessibilityLabel={`${name} is in your collection`}
              >
                <ThemedText type="smallBold" themeColor="accent">
                  ✓ Owned
                </ThemedText>
              </View>
            ) : (
              remove
            )
          }
        />
      ) : (
        <View style={styles.pending}>
          {scanned.status === 'looking-up' && <ActivityIndicator accessibilityLabel="Looking up" />}
          <ThemedText type="small" style={styles.fill}>
            {scanned.status === 'looking-up'
              ? `Looking up ${scanned.isbn}…`
              : scanned.status === 'not-found'
                ? `No book found for ISBN ${scanned.isbn}. Search by title later.`
                : `Couldn't look up ISBN ${scanned.isbn}.`}
          </ThemedText>
          {scanned.status === 'failed' && (
            <Pressable accessibilityRole="button" onPress={onRetry} hitSlop={8}>
              <ThemedText type="linkPrimary">Try again</ThemedText>
            </Pressable>
          )}
          {scanned.status !== 'looking-up' && remove}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  camera: {
    height: '40%',
    backgroundColor: '#000',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: Spacing.four,
  },
  hintBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  frame: {
    width: '75%',
    aspectRatio: 2.5,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: Spacing.three,
  },
  lightText: {
    color: '#fff',
  },
  panel: {
    flex: 1,
  },
  list: {
    paddingHorizontal: Spacing.four,
  },
  listHeader: {
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  row: {
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 48,
  },
  owned: {
    minWidth: 72,
    alignItems: 'flex-end',
  },
  remove: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  pressed: {
    opacity: 0.7,
  },
  footer: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  done: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  centered: {
    textAlign: 'center',
  },
});
