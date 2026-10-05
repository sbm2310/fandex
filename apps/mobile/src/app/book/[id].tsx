import { formatTitle, type CollectionItem } from '@fandex/core';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { CATEGORY_LABELS } from '@/components/category-badge';
import { EmptyState } from '@/components/empty-state';
import { PageTitle } from '@/components/page-title';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
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
        <PageTitle title="Book" />
        <ActivityIndicator accessibilityLabel="Loading book" />
      </ThemedView>
    );
  }

  if (!item) {
    return (
      <ThemedView style={styles.fill}>
        <PageTitle title="Book not found" />
        <EmptyState
          title="Book not found"
          message="This book isn't in your collection. It may have been removed."
          action={{ label: 'Back to collection', href: '/' }}
        />
      </ThemedView>
    );
  }

  return <BookDetail item={item} />;
}

function BookDetail({ item }: { item: CollectionItem }) {
  const { catalog } = item;

  return (
    <ThemedView style={styles.fill}>
      <PageTitle title={formatTitle(catalog)} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.column}>
          <View style={styles.coverWrap}>
            <BookCover coverUrl={catalog.coverUrl} title={catalog.title} width={180} />
          </View>

          <View style={styles.heading}>
            <ThemedText type="subtitle" style={styles.centeredText} accessibilityRole="header">
              {formatTitle(catalog)}
            </ThemedText>
            {catalog.authors.length > 0 && (
              <ThemedText themeColor="textSecondary" style={styles.centeredText}>
                {catalog.authors.join(', ')}
              </ThemedText>
            )}
          </View>

          <View style={styles.facts}>
            <Fact label="Type" value={CATEGORY_LABELS[item.category]} />
            <Fact label="Publisher" value={catalog.publisher} />
            <Fact label="Published" value={catalog.publishedYear?.toString()} />
            <Fact label="ISBN" value={catalog.isbn13} />
            <Fact label="Added" value={formatDate(item.addedAt)} />
          </View>

          <RemoveButton item={item} />
        </View>
      </ScrollView>
    </ThemedView>
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
