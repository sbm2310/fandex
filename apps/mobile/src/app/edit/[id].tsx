import {
  UNIVERSE_SEED,
  formatTitle,
  isEdited,
  itemLinks,
  type BookCategory,
  type CharacterRef,
  type CollectionItem,
  type CollectionItemChanges,
} from '@fandex/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { PageTitle } from '@/components/page-title';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useCollectionItem, useUpdateCollectionItem } from '@/hooks/use-collection';
import { useTheme } from '@/hooks/use-theme';

const CATEGORY_OPTIONS = [
  { value: 'book', label: 'Book' },
  { value: 'manga', label: 'Manga' },
  { value: 'comic', label: 'Comic' },
] as const satisfies readonly { value: BookCategory; label: string }[];

const sameCharacter = (a: CharacterRef, b: CharacterRef) =>
  a.universe === b.universe && a.character === b.character;

/** Fix what Fandex got wrong about an item: its category, universes and characters. */
export default function EditItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { item, isPending } = useCollectionItem(id);

  if (isPending) {
    return (
      <ThemedView style={styles.centered}>
        <PageTitle title="Fix details" />
        <ActivityIndicator accessibilityLabel="Loading" />
      </ThemedView>
    );
  }
  if (!item) {
    return (
      <ThemedView style={styles.fill}>
        <PageTitle title="Not found" />
        <EmptyState
          title="Not in your collection"
          message="This item isn't in your collection. It may have been removed."
          action={{ label: 'Back to collection', href: '/' }}
        />
      </ThemedView>
    );
  }
  return <EditItem item={item} />;
}

function EditItem({ item }: { item: CollectionItem }) {
  const colors = useTheme();
  const update = useUpdateCollectionItem();
  const current = itemLinks(item);
  const [category, setCategory] = useState(item.category);
  const [universes, setUniverses] = useState(current.universes);
  const [characters, setCharacters] = useState(current.characters);
  const title = formatTitle(item.catalog);

  function toggleUniverse(slug: string) {
    if (universes.includes(slug)) {
      setUniverses(universes.filter((u) => u !== slug));
      setCharacters(characters.filter((ref) => ref.universe !== slug));
    } else {
      setUniverses([...universes, slug]);
    }
  }

  function toggleCharacter(ref: CharacterRef) {
    setCharacters(
      characters.some((c) => sameCharacter(c, ref))
        ? characters.filter((c) => !sameCharacter(c, ref))
        : [...characters, ref],
    );
  }

  // Opened from a link or after a reload there's nothing to go back to: show the item instead.
  function close() {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/book/[id]', params: { id: item.id } });
  }

  function save(changes: CollectionItemChanges) {
    update.mutate({ id: item.id, changes }, { onSuccess: close });
  }

  function onSave() {
    save({
      ...(item.category !== 'lego' &&
        category !== item.category && { category: category as BookCategory }),
      links: { universes, characters },
    });
  }

  function onReset() {
    save({ ...(item.category !== 'lego' && { category: null }), links: null });
  }

  return (
    <ThemedView style={styles.fill}>
      <PageTitle title={`Fix ${title}`} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.column}>
          <View style={styles.heading}>
            <ThemedText type="subtitle" accessibilityRole="header">
              Fix details
            </ThemedText>
            <ThemedText themeColor="textSecondary">{title}</ThemedText>
          </View>

          {item.category !== 'lego' && (
            <View style={styles.section}>
              <ThemedText type="smallBold" accessibilityRole="header">
                Category
              </ThemedText>
              <SegmentedControl
                options={CATEGORY_OPTIONS}
                value={category as BookCategory}
                onChange={setCategory}
                accessibilityLabel="Category"
              />
            </View>
          )}

          <View style={styles.section}>
            <ThemedText type="smallBold" accessibilityRole="header">
              Universes and characters
            </ThemedText>
            {UNIVERSE_SEED.map((universe) => {
              const checked = universes.includes(universe.slug);
              return (
                <View key={universe.slug} style={styles.universe}>
                  <Toggle
                    label={universe.name}
                    checked={checked}
                    onPress={() => toggleUniverse(universe.slug)}
                    row
                  />
                  {checked && (
                    <View style={styles.chips} accessibilityLabel={`${universe.name} characters`}>
                      {universe.characters.map((character) => {
                        const ref = { universe: universe.slug, character: character.slug };
                        return (
                          <Toggle
                            key={character.slug}
                            label={character.name}
                            checked={characters.some((c) => sameCharacter(c, ref))}
                            onPress={() => toggleCharacter(ref)}
                          />
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {update.isError && (
            <ThemedText
              type="small"
              style={[styles.error, { color: colors.danger }]}
              accessibilityRole="alert"
            >
              Couldn&apos;t save your changes. Try again.
            </ThemedText>
          )}
          <View style={styles.actions}>
            <Button label="Save" onPress={onSave} busy={update.isPending} />
            <Button
              label="Cancel"
              variant="secondary"
              onPress={close}
              disabled={update.isPending}
            />
            {isEdited(item) && (
              <Button
                label="Reset to automatic"
                variant="secondary"
                onPress={onReset}
                disabled={update.isPending}
              />
            )}
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

/** A checkbox: a full row (universes) or a chip (characters). */
function Toggle({
  label,
  checked,
  onPress,
  row = false,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
  row?: boolean;
}) {
  const colors = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        row ? styles.row : styles.chip,
        { borderColor: checked && !row ? colors.accent : colors.border },
        checked && !row && { backgroundColor: colors.accent },
      ]}
    >
      {row && (
        <View
          style={[
            styles.box,
            { borderColor: checked ? colors.accent : colors.border },
            checked && { backgroundColor: colors.accent },
          ]}
        >
          {checked && (
            <ThemedText type="small" style={{ color: colors.onAccent }}>
              ✓
            </ThemedText>
          )}
        </View>
      )}
      <ThemedText
        type={row ? 'default' : 'small'}
        style={!row && checked ? { color: colors.onAccent } : undefined}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: {
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
  },
  column: { width: '100%', maxWidth: MaxContentWidth / 1.5, gap: Spacing.four },
  heading: { gap: Spacing.one },
  section: { gap: Spacing.three },
  universe: { gap: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  box: {
    width: 24,
    height: 24,
    borderWidth: 1.5,
    borderRadius: Spacing.one + Spacing.half,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    borderWidth: 1,
    borderRadius: Spacing.four,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  actions: { gap: Spacing.two },
  error: { textAlign: 'center' },
});
