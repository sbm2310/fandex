import type { UpdatePreorderRequest } from '@fandex/core';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { PageTitle } from '@/components/page-title';
import { PreorderForm, type PreorderFields } from '@/components/preorder-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { usePreorder, useUpdatePreorder } from '@/hooks/use-preorders';
import { preorderErrorMessage } from '@/utils/preorder-error';

/** The form's fields as a full update: anything left empty is cleared (null). */
function toUpdate(fields: PreorderFields): UpdatePreorderRequest {
  const text = (value: string | undefined) => value?.trim() || null;
  return {
    currency: fields.currency ?? 'USD',
    price: fields.price ?? null,
    paid: fields.paid ?? 0,
    balanceDueDate: fields.balanceDueDate ?? null,
    expectedRelease: fields.expectedRelease ?? null,
    store: text(fields.store),
    orderNumber: text(fields.orderNumber),
    orderUrl: text(fields.orderUrl),
    notes: text(fields.notes),
  };
}

export default function EditPreorderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { preorder, isPending, userPending } = usePreorder(id);
  const update = useUpdatePreorder();

  if (userPending || isPending) {
    return (
      <ThemedView style={[styles.fill, styles.centered]}>
        <PageTitle title="Edit pre-order" />
        <ActivityIndicator accessibilityLabel="Loading" />
      </ThemedView>
    );
  }
  if (!preorder) {
    return (
      <ThemedView style={styles.fill}>
        <PageTitle title="Not found" />
        <EmptyState title="No such pre-order" message="It may have been deleted." />
      </ThemedView>
    );
  }

  const close = () =>
    router.canGoBack()
      ? router.back()
      : router.replace({ pathname: '/preorder/[id]', params: { id: preorder.id } });

  return (
    <ThemedView style={styles.fill}>
      <PageTitle title={`Edit pre-order: ${preorder.catalog.title}`} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.column}>
          <View style={styles.heading}>
            <ThemedText type="subtitle" accessibilityRole="header">
              Edit pre-order
            </ThemedText>
            <ThemedText themeColor="textSecondary">{preorder.catalog.title}</ThemedText>
          </View>
          <PreorderForm
            initial={preorder}
            submitLabel="Save changes"
            busy={update.isPending}
            error={update.isError ? preorderErrorMessage(update.error) : undefined}
            onSubmit={(fields) =>
              update.mutate({ id: preorder.id, changes: toUpdate(fields) }, { onSuccess: close })
            }
          />
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  content: { alignItems: 'center', paddingVertical: Spacing.four },
  column: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  heading: { gap: Spacing.one },
});
