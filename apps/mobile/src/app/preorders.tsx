import { formatRelease, type PreorderResponse } from '@fandex/core';
import { Link } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { EntryRow } from '@/components/entry-row';
import { PageTitle } from '@/components/page-title';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { usePreorders } from '@/hooks/use-preorders';
import { toCatalogEntry } from '@/services/catalog-mapping';

const STATUS: Record<PreorderResponse['status'], string> = {
  ordered: 'On order',
  arrived: 'Arrived',
  cancelled: 'Cancelled',
};

/** All the user's pre-orders, newest first, each opening its page. */
export default function PreordersScreen() {
  const { data, isPending, signedIn, userPending } = usePreorders();

  if (userPending || (signedIn && isPending)) {
    return (
      <ThemedView style={[styles.fill, styles.centered]}>
        <PageTitle title="Pre-orders" />
        <ActivityIndicator accessibilityLabel="Loading" />
      </ThemedView>
    );
  }
  if (!signedIn) {
    return (
      <ThemedView style={styles.fill}>
        <PageTitle title="Pre-orders" />
        <EmptyState
          title="Sign in to track pre-orders"
          message="Pre-orders keep payments and release dates in your account, on all your devices."
          action={{ label: 'Sign in', href: '/account' }}
        />
      </ThemedView>
    );
  }
  if (!data || data.length === 0) {
    return (
      <ThemedView style={styles.fill}>
        <PageTitle title="Pre-orders" />
        <EmptyState
          title="No pre-orders yet"
          message="Find something on the Add tab and choose Pre-order, or describe a figure that's on order."
          action={{ label: 'Go to Add', href: '/add' }}
        />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.fill}>
      <PageTitle title="Pre-orders" />
      <FlatList
        data={data}
        keyExtractor={(preorder) => preorder.id}
        contentContainerStyle={styles.list}
        renderItem={({ item: preorder }) => {
          const entry = toCatalogEntry(preorder.catalog);
          const when = preorder.expectedRelease
            ? formatRelease(preorder.expectedRelease)
            : 'No date yet';
          return (
            <Link href={{ pathname: '/preorder/[id]', params: { id: preorder.id } }} asChild>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={`${preorder.catalog.title}: ${STATUS[preorder.status]}, expected ${when}`}
                style={styles.row}
              >
                {entry ? <EntryRow entry={entry} showUniverses={false} /> : null}
                <ThemedText type="small" themeColor="textSecondary" style={styles.meta}>
                  {STATUS[preorder.status]} · {when}
                </ThemedText>
              </Pressable>
            </Link>
          );
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  list: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  row: { paddingVertical: Spacing.two },
  meta: { paddingLeft: 48 + Spacing.three },
});
