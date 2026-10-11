import { releaseDateSchema, type NewFigure, type ReleaseDate } from '@fandex/core';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { PageTitle } from '@/components/page-title';
import { PreorderForm } from '@/components/preorder-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useCurrentUser } from '@/hooks/use-account';
import { useCreatePreorder } from '@/hooks/use-preorders';
import { preorderErrorMessage } from '@/utils/preorder-error';

type Params = {
  /** A catalog item (search result, owned item)… */
  catalogId?: string;
  /** …or a figure described on the Add tab, saved only when the pre-order is. */
  figure?: string;
  title?: string;
  /** A book's release date from Open Library (YYYY-MM-DD and its precision), offered as is. */
  release?: string;
  releasePrecision?: string;
  brand?: string;
  line?: string;
  scale?: string;
  coverUrl?: string;
};

/** Pre-orders something: a catalog item, or a figure that's on order (account only). */
export default function NewPreorderScreen() {
  const params = useLocalSearchParams<Params>();
  const { data: user, isPending } = useCurrentUser();
  const create = useCreatePreorder();
  const title = params.title ?? 'this item';
  const suggestedRelease = catalogRelease(params);

  if (isPending) {
    return (
      <ThemedView style={[styles.fill, styles.centered]}>
        <PageTitle title="Pre-order" />
        <ActivityIndicator accessibilityLabel="Loading" />
      </ThemedView>
    );
  }
  if (!user) {
    return (
      <ThemedView style={styles.fill}>
        <PageTitle title="Pre-order" />
        <EmptyState
          title="Sign in to track pre-orders"
          message="Pre-orders keep payments and release dates in your account, on all your devices."
          action={{ label: 'Sign in', href: '/account' }}
        />
      </ThemedView>
    );
  }
  if (!params.catalogId && !params.figure) {
    return (
      <ThemedView style={styles.fill}>
        <PageTitle title="Pre-order" />
        <EmptyState
          title="Nothing to pre-order"
          message="Find the item on the Add tab first, then choose Pre-order."
          action={{ label: 'Go to Add', href: '/add' }}
        />
      </ThemedView>
    );
  }

  const figure: NewFigure | undefined = params.figure
    ? {
        title,
        ...(params.brand && { brand: params.brand }),
        ...(params.line && { line: params.line }),
        ...(params.scale && { scale: params.scale }),
        ...(params.coverUrl && { coverUrl: params.coverUrl }),
      }
    : undefined;

  return (
    <ThemedView style={styles.fill}>
      <PageTitle title={`Pre-order ${title}`} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.column}>
          <View style={styles.heading}>
            <ThemedText type="subtitle" accessibilityRole="header">
              Pre-order
            </ThemedText>
            <ThemedText themeColor="textSecondary">{title}</ThemedText>
          </View>
          <PreorderForm
            submitLabel="Save pre-order"
            {...(suggestedRelease && { suggestedRelease })}
            busy={create.isPending}
            error={create.isError ? preorderErrorMessage(create.error) : undefined}
            onSubmit={(fields) =>
              create.mutate(
                figure
                  ? { kind: 'figure', figure, request: fields }
                  : { kind: 'catalog', request: { ...fields, catalogItemId: params.catalogId! } },
                {
                  onSuccess: (preorder) =>
                    router.replace({ pathname: '/preorder/[id]', params: { id: preorder.id } }),
                },
              )
            }
          />
        </View>
      </ScrollView>
    </ThemedView>
  );
}

/** The release date in the URL, if it's a valid one. */
function catalogRelease({ release, releasePrecision }: Params): ReleaseDate | undefined {
  const parsed = releaseDateSchema.safeParse({ date: release, precision: releasePrecision });
  return parsed.success ? parsed.data : undefined;
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    paddingVertical: Spacing.four,
  },
  column: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  heading: {
    gap: Spacing.one,
  },
});
