import { sortCollection } from '@fandex/core';
import { Link, type Href } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { countByCategory } from '@/components/category-filter';
import { GRID_GAP, GridItem, useGridLayout } from '@/components/collection-grid';
import { ComingUpRow, useComingUp } from '@/components/coming-up';
import { EmptyState } from '@/components/empty-state';
import { MoveToAccountBanner } from '@/components/move-to-account-banner';
import { PageTitle } from '@/components/page-title';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { NOUNS, UniverseCard } from '@/components/universe-card';
import { Fonts, Spacing } from '@/constants/theme';
import { useCollection, useDeviceCollection } from '@/hooks/use-collection';
import { useTheme } from '@/hooks/use-theme';
import { useCollectionUniverses } from '@/hooks/use-universes';

/** How many of the newest items "Recently added" shows (two rows of three). */
const RECENT = 6;

/**
 * Home, "Your shelf": how big the collection is, Ask, your universes, what's coming up, what you
 * added last, and the way to everything (`/collection`).
 */
export default function CollectionScreen() {
  const collection = useCollection();
  // Signed in: also read this device's books (local, fast) to offer moving them to the account.
  const device = useDeviceCollection({ enabled: collection.mode === 'account' });
  const deviceCount = device.data?.length ?? 0;
  const banner = collection.mode === 'account' && <MoveToAccountBanner deviceCount={deviceCount} />;
  const { universes } = useCollectionUniverses();
  const comingUp = useComingUp();
  const grid = useGridLayout();

  if (collection.isPending || (collection.mode === 'account' && device.isPending)) {
    return (
      <Screen>
        <PageTitle title="My collection" />
        <View style={styles.centered}>
          <ActivityIndicator accessibilityLabel="Loading your collection" />
        </View>
      </Screen>
    );
  }

  if (collection.isError) {
    return (
      <Screen>
        <PageTitle title="My collection" />
        <EmptyState
          title="Couldn't load your collection"
          message={
            collection.mode === 'account'
              ? "Can't reach the Fandex server. Check your connection and try again."
              : "Your saved books couldn't be read. They haven't been deleted."
          }
        />
      </Screen>
    );
  }

  if (collection.data.length === 0) {
    return (
      <Screen>
        <PageTitle title="My collection" />
        {banner}
        <EmptyState
          title="Your collection is empty"
          message="Add books by searching for a title or scanning an ISBN barcode."
          action={{ label: 'Add your first book', href: '/add' }}
        />
      </Screen>
    );
  }

  const items = collection.data;
  const universeCount = universes?.length ?? 0;
  const itemCount = items.length === 1 ? '1 item' : `${items.length} items`;
  const headline =
    universeCount > 0
      ? `${itemCount} across ${universeCount === 1 ? '1 universe' : `${universeCount} universes`}`
      : `${itemCount} on your shelf`;
  const recent = sortCollection(items, 'recent').slice(0, RECENT);
  // Three covers to a row, across the same width the full grid uses.
  const contentWidth = grid.columns * grid.itemWidth + GRID_GAP * (grid.columns - 1);
  const recentWidth = Math.floor((contentWidth - GRID_GAP * 2) / 3);

  return (
    <Screen>
      <PageTitle title="My collection" />
      {/* Same place as on the empty screen, so moving the device's items keeps its message. */}
      {banner}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ThemedText type="overline" themeColor="textSecondary">
            Your shelf
          </ThemedText>
          <ThemedText type="subtitle" accessibilityRole="header">
            {headline}
          </ThemedText>
          <View style={styles.chips}>
            {[...countByCategory(items)].map(([category, count]) => (
              <CountChip
                key={category}
                label={`${count} ${NOUNS[category][count === 1 ? 0 : 1]}`}
              />
            ))}
          </View>
        </View>

        <AskLink />

        {universes && universes.length > 0 && (
          <Section
            title="Your universes"
            link={{
              href: '/universes',
              label: universes.length === 1 ? 'All' : `All ${universes.length}`,
              accessibilityLabel: 'All your universes',
            }}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.universes}
            >
              {universes.map((universe) => (
                <UniverseCard key={universe.slug} universe={universe} compact />
              ))}
            </ScrollView>
          </Section>
        )}

        {comingUp.length > 0 && (
          <Section
            title="Coming up"
            link={{ href: '/upcoming', label: 'Upcoming', accessibilityLabel: 'All pre-orders' }}
          >
            {comingUp.map((event) => (
              <ComingUpRow key={event.preorder.id} event={event} />
            ))}
          </Section>
        )}

        <Section
          title="Recently added"
          link={{
            href: '/collection',
            label: 'Everything',
            accessibilityLabel: `Everything: all ${itemCount}`,
          }}
        >
          <View style={styles.recent}>
            {recent.map((item) => (
              <GridItem key={item.id} item={item} width={recentWidth} />
            ))}
          </View>
        </Section>

        <Link href="/series" accessibilityLabel="Your series: what you're missing and what's next">
          <ThemedText type="linkPrimary">Your series ›</ThemedText>
        </Link>
      </ScrollView>
    </Screen>
  );
}

/** A count in a quiet rounded chip ("2 books"). */
function CountChip({ label }: { label: string }) {
  const colors = useTheme();
  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: colors.backgroundElement, borderColor: colors.border },
      ]}
    >
      <ThemedText type="small" style={styles.chipLabel}>
        {label}
      </ThemedText>
    </View>
  );
}

/** A home section: a heading with a link on the right ("All 5", "Everything"), then its content. */
function Section({
  title,
  link,
  children,
}: {
  title: string;
  link: { href: Href; label: string; accessibilityLabel: string };
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <ThemedText type="section" accessibilityRole="header">
          {title}
        </ThemedText>
        <Link href={link.href} accessibilityLabel={link.accessibilityLabel}>
          <ThemedText type="linkPrimary">{link.label}</ThemedText>
        </Link>
      </View>
      {children}
    </View>
  );
}

/** Opens "Ask your collection" (looks like a search field; questions are typed there). */
function AskLink() {
  const colors = useTheme();
  // Link asChild needs a single style object on its child (no arrays or style functions).
  return (
    <Link href="/ask" asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Ask your collection, for example: What Batman stuff do I own?"
        style={StyleSheet.flatten([
          styles.ask,
          { backgroundColor: colors.backgroundElement, borderColor: colors.border },
        ])}
      >
        <SymbolView
          name={{ ios: 'sparkle.magnifyingglass', android: 'manage_search', web: 'manage_search' }}
          tintColor={colors.textSecondary}
          size={20}
        />
        <ThemedText themeColor="textSecondary">Ask your collection…</ThemedText>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  ask: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    gap: Spacing.five,
    paddingBottom: Spacing.four,
  },
  header: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingTop: Spacing.one,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + Spacing.half,
  },
  chipLabel: {
    fontFamily: Fonts.semiBold,
  },
  section: {
    gap: Spacing.three,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  universes: {
    gap: Spacing.three,
  },
  recent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
});
