import {
  formatMoney,
  formatRelease,
  formatTitle,
  isBookItem,
  isEdited,
  itemLinks,
  releasePeriodEnd,
  type CatalogFigure,
  type CollectionItem,
} from '@fandex/core';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { ItemArtwork } from '@/components/item-artwork';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { AlsoOwnedEditions } from '@/components/other-editions';
import { CATEGORY_LABELS } from '@/components/category-badge';
import { EmptyState } from '@/components/empty-state';
import { FigureSuggestionSection } from '@/components/figure-suggestion';
import { PageTitle } from '@/components/page-title';
import { SeriesSection } from '@/components/series-section';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CharacterChips, UniverseChips } from '@/components/universe-links';
import { Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useCollectionItem, useRemoveFromCollection } from '@/hooks/use-collection';
import { useTheme } from '@/hooks/use-theme';
import { confirm } from '@/utils/confirm';
import { localToday } from '@/utils/today';

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
  const remove = useRemoveFromCollection();
  const colors = useTheme();
  // Books are covers (2:3); sets and figures are product photos or a box, a little squarer.
  const hero = isBookItem(item)
    ? { width: 180, aspectRatio: 1.5 }
    : { width: 230, aspectRatio: 1.26 };

  return (
    <ThemedView style={styles.fill}>
      <PageTitle title={formatTitle(catalog)} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.column}>
          <View style={styles.coverWrap}>
            <ItemArtwork entry={catalog} {...hero} />
          </View>

          <View style={styles.heading}>
            <ThemedText type="subtitle" style={styles.centeredText} accessibilityRole="header">
              {formatTitle(catalog)}
            </ThemedText>
            <Byline item={item} />
            <Links item={item} />
            <View style={styles.centeredRow}>
              <AlsoOwnedEditions entry={catalog} />
            </View>
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
            ) : item.category === 'figure' ? (
              <FigureFacts figure={item.catalog} />
            ) : (
              <>
                <Fact label="Publisher" value={item.catalog.publisher} />
                <Fact label="Published" value={item.catalog.publishedYear?.toString()} />
                <Fact label="ISBN" value={item.catalog.isbn13} />
              </>
            )}
            <Fact label="Added" value={formatDate(item.addedAt)} />
          </View>

          {item.category === 'figure' && <FigureSources figure={item.catalog} />}
          {item.category === 'figure' && <FigureSuggestionSection figure={item.catalog} />}

          <SeriesSection item={item} />

          <View style={styles.actionsArea}>
            {isEdited(item) && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
                You&apos;ve edited this item&apos;s details.
              </ThemedText>
            )}
            <View style={styles.actions}>
              <View style={styles.action}>
                <Button
                  label="Fix details"
                  variant="secondary"
                  onPress={() => router.push({ pathname: '/edit/[id]', params: { id: item.id } })}
                />
              </View>
              <View style={styles.action}>
                <RemoveButton item={item} remove={remove} />
              </View>
            </View>
            {remove.isError && (
              <ThemedText type="small" style={[styles.centeredText, { color: colors.danger }]}>
                Couldn&apos;t remove this item. Try again.
              </ThemedText>
            )}
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

/** Under a book's title: its authors (sets and figures show their maker among the facts). */
function Byline({ item }: { item: CollectionItem }) {
  if (!isBookItem(item) || item.catalog.authors.length === 0) return null;
  return (
    <ThemedText themeColor="textSecondary" style={styles.centeredText}>
      {item.catalog.authors.join(', ')}
    </ThemedText>
  );
}

/** The universes and characters this item belongs to, each opening its page. */
function Links({ item }: { item: CollectionItem }) {
  const { universes, characters } = itemLinks(item);
  if (universes.length === 0 && characters.length === 0) return null;
  return (
    <View style={styles.links}>
      <UniverseChips universes={universes} centered />
      <CharacterChips characters={characters} centered />
    </View>
  );
}

function FigureFacts({ figure }: { figure: CatalogFigure }) {
  const { release } = figure;
  const released = release && releasePeriodEnd(release) < localToday();
  return (
    <>
      <Fact label="Brand" value={figure.brand} />
      <Fact label="Number" value={figure.number} />
      <Fact label="Line" value={figure.line} />
      <Fact label="Edition" value={figure.edition} />
      <Fact label="Scale" value={figure.scale} />
      <Fact label={released ? 'Released' : 'Expected'} value={release && formatRelease(release)} />
      <Fact
        label="Original price"
        value={figure.price && formatMoney(figure.price.amount, figure.price.currency)}
      />
    </>
  );
}

/** Where a curated figure's facts came from: each page by its site name, as a link. */
function FigureSources({ figure }: { figure: CatalogFigure }) {
  const colors = useTheme();
  if (figure.source !== 'fandex' || !figure.sources?.length) return null;
  const count = figure.sources.length;
  return (
    <Card style={styles.sourcesCard}>
      <View style={styles.sourcesHeading}>
        <SymbolView
          name={{ ios: 'checkmark.seal', android: 'verified', web: 'verified' }}
          tintColor={colors.accent}
          size={18}
        />
        <ThemedText type="smallBold" accessibilityRole="header">
          Checked against {count} {count === 1 ? 'source' : 'sources'}
        </ThemedText>
      </View>
      <View style={styles.sources}>
        {figure.sources.map((url) => (
          <Link key={url} href={url as `https:${string}`} target="_blank">
            <ThemedText type="small" themeColor="accent">
              {siteName(url)}
            </ThemedText>
          </Link>
        ))}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        From Fandex&apos;s figure catalog
      </ThemedText>
    </Card>
  );
}

/**
 * "https://www.bigbadtoystore.com/Product/…" → "bigbadtoystore.com". (A regex: React Native's
 * URL doesn't implement `hostname`.)
 */
function siteName(url: string): string {
  return /^https?:\/\/(?:www\.)?([^/?#]+)/i.exec(url)?.[1] ?? url;
}

/** One fact as a small card: its label above, the value below. Two to a row. */
function Fact({ label, value }: { label: string; value: string | undefined }) {
  if (!value) return null;
  return (
    <Card style={styles.fact}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText style={styles.factValue} selectable>
        {value}
      </ThemedText>
    </Card>
  );
}

function RemoveButton({
  item,
  remove,
}: {
  item: CollectionItem;
  remove: ReturnType<typeof useRemoveFromCollection>;
}) {
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
    <Button
      label="Remove"
      accessibilityLabel={`Remove ${title} from collection`}
      variant="danger"
      busy={remove.isPending}
      onPress={() => void onPress()}
    />
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
    gap: Spacing.two,
  },
  centeredText: {
    textAlign: 'center',
  },
  centeredRow: {
    alignItems: 'center',
  },
  // Universe and character chips share one centred, wrapping row.
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.one,
  },
  facts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  fact: {
    // Two to a row; an odd last one takes the whole row.
    flexGrow: 1,
    flexBasis: '40%',
    gap: Spacing.half,
    paddingVertical: Spacing.two + Spacing.one,
  },
  factValue: {
    fontFamily: Fonts.display,
    fontSize: 17,
    lineHeight: 22,
  },
  sourcesCard: {
    gap: Spacing.two,
  },
  sourcesHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  sources: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Spacing.three,
    rowGap: Spacing.one,
  },
  actionsArea: {
    gap: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  action: {
    flex: 1,
  },
});
