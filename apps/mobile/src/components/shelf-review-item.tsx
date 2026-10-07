import { formatTitle, type CatalogEntry, type ShelfScanItem } from '@fandex/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { EntryRow } from './entry-row';
import { ThemedText } from './themed-text';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { toCatalogEntry } from '@/services/catalog-mapping';
import type { ShelfChoice } from '@/utils/shelf-selection';

type Props = {
  item: ShelfScanItem;
  choice: ShelfChoice;
  onToggle: () => void;
  onChoose: (candidate: number) => void;
};

/** "Vagabond" (manga) — the set number keeps same-named LEGO sets apart in labels. */
function labelFor(entry: CatalogEntry): string {
  return entry.category === 'lego' ? `${entry.title} (set ${entry.setNumber})` : formatTitle(entry);
}

/**
 * One thing the AI read on the shelf: the catalog entry it most likely is, with a tick box,
 * other possible matches to switch to, or — when nothing matched — a search for it.
 */
export function ShelfReviewItem({ item, choice, onToggle, onChoose }: Props) {
  const colors = useTheme();
  const [showOthers, setShowOthers] = useState(false);
  const { reading, candidates } = item;
  const read = `Read “${reading.title}”${reading.count > 1 ? ` · ${reading.count} on the shelf` : ''}`;

  if (candidates.length === 0) {
    return (
      <View style={[styles.item, { borderColor: colors.border }]}>
        <ThemedText type="small" themeColor="textSecondary">
          {read}
        </ThemedText>
        <View style={styles.noMatch}>
          <ThemedText type="small" style={styles.flex}>
            No match in the catalog.
          </ThemedText>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`Search for ${reading.title}`}
            hitSlop={8}
            onPress={() =>
              router.navigate({
                pathname: '/add',
                params: {
                  q: reading.englishTitle ?? reading.title,
                  kind: reading.kind === 'lego' ? 'lego' : 'books',
                  // A new value each time, so the Add screen applies it even if already open.
                  scan: String(Date.now()),
                },
              })
            }
          >
            <ThemedText type="linkPrimary">Search</ThemedText>
          </Pressable>
        </View>
      </View>
    );
  }

  const selected = candidates[choice.candidate] ?? candidates[0]!;
  const entry = toCatalogEntry(selected.item);
  if (!entry) return null;
  const label = labelFor(entry);

  return (
    <View style={[styles.item, { borderColor: colors.border }]}>
      <ThemedText type="small" themeColor="textSecondary">
        {read}
      </ThemedText>
      <EntryRow
        entry={entry}
        accessory={
          selected.owned ? (
            <View
              style={styles.slot}
              accessible
              accessibilityLabel={`${label} is in your collection`}
            >
              <ThemedText type="smallBold" themeColor="accent">
                ✓ Owned
              </ThemedText>
            </View>
          ) : (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: choice.checked }}
              accessibilityLabel={`Add ${label}`}
              onPress={onToggle}
              hitSlop={8}
              style={StyleSheet.flatten([
                styles.box,
                { borderColor: colors.accent },
                choice.checked && { backgroundColor: colors.accent },
              ])}
            >
              {choice.checked ? (
                <ThemedText type="smallBold" style={{ color: colors.onAccent }}>
                  ✓
                </ThemedText>
              ) : null}
            </Pressable>
          )
        }
      />
      {candidates.length > 1 && (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: showOthers }}
          onPress={() => setShowOthers((shown) => !shown)}
        >
          <ThemedText type="linkPrimary">
            {showOthers
              ? 'Hide other matches'
              : `Not this one? ${candidates.length - 1} other matches`}
          </ThemedText>
        </Pressable>
      )}
      {showOthers &&
        candidates.map((candidate, index) => {
          if (index === choice.candidate) return null;
          const other = toCatalogEntry(candidate.item);
          if (!other) return null;
          return (
            <Pressable
              key={candidate.item.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: false }}
              accessibilityLabel={`Choose ${labelFor(other)}${candidate.owned ? ', in your collection' : ''}`}
              onPress={() => {
                onChoose(index);
                setShowOthers(false);
              }}
              style={({ pressed }) => [styles.other, pressed && styles.pressed]}
            >
              <EntryRow entry={other} />
            </Pressable>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  noMatch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  flex: {
    flex: 1,
  },
  slot: {
    minWidth: 72,
    alignItems: 'flex-end',
  },
  box: {
    width: 28,
    height: 28,
    borderWidth: 2,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  other: {
    paddingLeft: Spacing.four,
  },
  pressed: {
    opacity: 0.7,
  },
});
