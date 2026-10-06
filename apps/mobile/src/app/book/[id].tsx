import { formatTitle, isEdited, itemLinks, type CollectionItem } from '@fandex/core';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { Button } from '@/components/button';
import { CATEGORY_LABELS } from '@/components/category-badge';
import { EmptyState } from '@/components/empty-state';
import { PageTitle } from '@/components/page-title';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CharacterChips, UniverseChips } from '@/components/universe-links';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useCollectionItem, useRemoveFromCollection } from '@/hooks/use-collection';
import { useTheme } from '@/hooks/use-theme';
import { confirm } from '@/utils/confirm';

export default function BookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { item, isPending } = useCollectionItem(id);

  if (isPending) {
    return (
      <ThemedView style={styles.centered}>
        {/* Every state sets a title, like the tab screens (see PageTitle). */}
        <PageTitle title="Loading" />
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

  return <BookDetail item={item} />;
}

function BookDetail({ item }: { item: CollectionItem }) {
  const { catalog } = item;
  const isSet = item.category === 'lego';
  const byline = item.category === 'lego' ? undefined : item.catalog.authors.join(', ');

  return (
    <ThemedView style={styles.fill}>
      <PageTitle title={formatTitle(catalog)} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.column}>
          <View style={styles.coverWrap}>
            <BookCover
              coverUrl={catalog.coverUrl}
              title={catalog.title}
              width={180}
              fit={isSet ? 'contain' : 'cover'}
            />
          </View>

          <View style={styles.heading}>
            <ThemedText type="subtitle" style={styles.centeredText} accessibilityRole="header">
              {formatTitle(catalog)}
            </ThemedText>
            {byline ? (
              <ThemedText themeColor="textSecondary" style={styles.centeredText}>
                {byline}
              </ThemedText>
            ) : null}
          </View>

          <View style={styles.facts}>
            <Fact label="Type" value={CATEGORY_LABELS[item.category]} />
            {item.category === 'lego' ? (
              <>
                <Fact label="Set number" value={item.catalog.setNumber} />
                <Fact label="Pieces" value={item.catalog.pieceCount?.toLocaleString('en-US')} />
                <Fact
                  label="Theme"
                  value={
                    [item.catalog.theme, item.catalog.subtheme].filter(Boolean).join(' › ') ||
                    undefined
                  }
                />
                <Fact label="Released" value={item.catalog.year?.toString()} />
              </>
            ) : (
              <>
                <Fact label="Publisher" value={item.catalog.publisher} />
                <Fact label="Published" value={item.catalog.publishedYear?.toString()} />
                <Fact label="ISBN" value={item.catalog.isbn13} />
              </>
            )}
            <Fact label="Added" value={formatDate(item.addedAt)} />
          </View>

          <Links item={item} />

          <View style={styles.fix}>
            {isEdited(item) && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
                You&apos;ve edited this item&apos;s details.
              </ThemedText>
            )}
            <Button
              label="Fix details"
              variant="secondary"
              onPress={() => router.push({ pathname: '/edit/[id]', params: { id: item.id } })}
            />
          </View>

          <RemoveButton item={item} />
        </View>
      </ScrollView>
    </ThemedView>
  );
}

/** The universes and characters this item belongs to, each opening its page. */
function Links({ item }: { item: CollectionItem }) {
  const { universes, characters } = itemLinks(item);
  if (universes.length === 0 && characters.length === 0) return null;
  return (
    <View style={styles.links}>
      {universes.length > 0 && (
        <View style={styles.linkGroup}>
          <ThemedText type="small" themeColor="textSecondary" accessibilityRole="header">
            {universes.length === 1 ? 'Universe' : 'Universes'}
          </ThemedText>
          <UniverseChips universes={universes} />
        </View>
      )}
      {characters.length > 0 && (
        <View style={styles.linkGroup}>
          <ThemedText type="small" themeColor="textSecondary" accessibilityRole="header">
            Characters
          </ThemedText>
          <CharacterChips characters={characters} />
        </View>
      )}
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string | undefined }) {
  const colors = useTheme();
  if (!value) return null;
  return (
    <View style={[styles.fact, { borderBottomColor: colors.border }]}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="small" selectable>
        {value}
      </ThemedText>
    </View>
  );
}

function RemoveButton({ item }: { item: CollectionItem }) {
  const colors = useTheme();
  const remove = useRemoveFromCollection();
  const title = formatTitle(item.catalog);

  async function onPress() {
    const confirmed = await confirm({
      title: 'Remove from collection?',
      message: `“${title}” will be removed from your collection.`,
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!confirmed) return;

    remove.mutate(item.id, {
      onSuccess: () => (router.canGoBack() ? router.back() : router.replace('/')),
    });
  }

  return (
    <View style={styles.removeArea}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove ${title} from collection`}
        disabled={remove.isPending}
        onPress={() => void onPress()}
        style={({ pressed }) => [
          styles.removeButton,
          { borderColor: colors.danger },
          (pressed || remove.isPending) && styles.pressed,
        ]}
      >
        {remove.isPending ? (
          <ActivityIndicator color={colors.danger} />
        ) : (
          <ThemedText type="smallBold" style={{ color: colors.danger }}>
            Remove from collection
          </ThemedText>
        )}
      </Pressable>
      {remove.isError && (
        <ThemedText type="small" style={[styles.centeredText, { color: colors.danger }]}>
          Couldn&apos;t remove this book. Try again.
        </ThemedText>
      )}
    </View>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
  },
  column: {
    width: '100%',
    maxWidth: MaxContentWidth / 1.5,
    gap: Spacing.four,
  },
  links: {
    gap: Spacing.three,
  },
  fix: {
    gap: Spacing.two,
  },
  linkGroup: {
    gap: Spacing.two,
  },
  coverWrap: {
    alignItems: 'center',
  },
  heading: {
    gap: Spacing.one,
  },
  centeredText: {
    textAlign: 'center',
  },
  facts: {
    gap: Spacing.two,
  },
  fact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingBottom: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  removeArea: {
    gap: Spacing.two,
  },
  removeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Spacing.three,
  },
  pressed: {
    opacity: 0.6,
  },
});
