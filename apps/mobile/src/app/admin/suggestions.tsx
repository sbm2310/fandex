import type { AdminFigureSuggestion, CatalogItemResponse } from '@fandex/core';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { EntryRow } from '@/components/entry-row';
import { FormField } from '@/components/form-field';
import { PageTitle } from '@/components/page-title';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useDecideSuggestion, useIsAdmin, usePendingSuggestions } from '@/hooks/use-admin';
import { useTheme } from '@/hooks/use-theme';
import { AdminReviewError } from '@/services/admin-reviews';
import { toCatalogEntry } from '@/services/catalog-mapping';
import { confirm } from '@/utils/confirm';

/**
 * Figures users suggested for the shared catalog, oldest first: approve one as a new shared
 * figure, merge it into a figure the catalog already has, or reject it with a reason. Not in
 * the tabs; admins reach it from the Account tab.
 */
export default function SuggestionsScreen() {
  const { isAdmin, isPending } = useIsAdmin();

  return (
    <ThemedView style={styles.fill}>
      <PageTitle title="Figure suggestions" />
      {isPending ? (
        <View style={[styles.fill, styles.centered]}>
          <ActivityIndicator accessibilityLabel="Loading" />
        </View>
      ) : isAdmin ? (
        <Queue />
      ) : (
        <EmptyState
          title="Admins only"
          message="Figure suggestions are reviewed by Fandex's admins."
          action={{ label: 'Back to your account', href: '/account' }}
        />
      )}
    </ThemedView>
  );
}

function Queue() {
  const pending = usePendingSuggestions();

  if (pending.isPending) {
    return (
      <View style={[styles.fill, styles.centered]}>
        <ActivityIndicator accessibilityLabel="Loading suggestions" />
      </View>
    );
  }
  if (pending.isError) {
    return (
      <EmptyState
        title="Couldn't load suggestions"
        message="Check your connection and try again."
        action={{ label: 'Try again', onPress: () => void pending.refetch() }}
      />
    );
  }
  if (pending.data.length === 0) {
    return (
      <EmptyState
        title="Nothing to review"
        message="New figure suggestions will show up here."
        action={{ label: 'Back to your account', href: '/account' }}
      />
    );
  }
  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.column}>
        <ThemedText type="subtitle" accessibilityRole="header">
          Figure suggestions
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          {pending.data.length === 1
            ? '1 figure is waiting for review.'
            : `${pending.data.length} figures are waiting for review.`}{' '}
          Approved figures join the shared catalog without their picture.
        </ThemedText>
        {pending.data.map((suggestion) => (
          <SuggestionCard key={suggestion.id} suggestion={suggestion} />
        ))}
      </View>
    </ScrollView>
  );
}

function SuggestionCard({ suggestion }: { suggestion: AdminFigureSuggestion }) {
  const colors = useTheme();
  const decide = useDecideSuggestion();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const figure = suggestion.figure && toCatalogEntry(suggestion.figure);
  const title = suggestion.figure?.title ?? 'this figure';

  const approve = async () => {
    const confirmed = await confirm({
      title: 'Add to the shared catalog?',
      message: `Every collector will be able to find “${title}”. Its picture isn't shared.`,
      confirmLabel: 'Approve',
    });
    if (confirmed) decide.mutate({ kind: 'approve', id: suggestion.id });
  };

  const merge = async (target: CatalogItemResponse) => {
    const confirmed = await confirm({
      title: 'Merge into the catalog figure?',
      message: `“${title}” will be replaced by “${target.title}” in the suggester's collection and pre-orders.`,
      confirmLabel: 'Merge',
      destructive: true,
    });
    if (confirmed) decide.mutate({ kind: 'merge', id: suggestion.id, targetId: target.id });
  };

  return (
    <View
      style={[styles.card, { borderColor: colors.border }]}
      accessibilityLabel={`Suggestion: ${title}`}
    >
      {figure ? <EntryRow entry={figure} showUniverses /> : null}
      <ThemedText type="small" themeColor="textSecondary">
        Suggested by {suggestion.suggestedBy.name} ({suggestion.suggestedBy.email})
      </ThemedText>
      {suggestion.note ? <ThemedText type="small">“{suggestion.note}”</ThemedText> : null}

      {suggestion.candidates.length > 0 ? (
        <View style={styles.candidates}>
          <ThemedText type="smallBold" accessibilityRole="header">
            Already in the catalog?
          </ThemedText>
          {suggestion.candidates.map(({ item, sameFigure }) => {
            const entry = toCatalogEntry(item);
            if (!entry) return null;
            return (
              <View key={item.id} style={styles.candidate}>
                {sameFigure ? (
                  <ThemedText type="small" themeColor="accent">
                    Likely the same figure
                  </ThemedText>
                ) : null}
                <EntryRow
                  entry={entry}
                  showUniverses={false}
                  accessory={
                    <Button
                      label={`Merge into ${item.title}`}
                      variant="secondary"
                      onPress={() => void merge(item)}
                      disabled={decide.isPending}
                    />
                  }
                />
              </View>
            );
          })}
        </View>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          No similar figure in the catalog.
        </ThemedText>
      )}

      {rejecting ? (
        <View style={styles.reject}>
          <FormField
            label="Why not? (the suggester sees this)"
            value={reason}
            onChangeText={setReason}
            placeholder="Please add the number on the box."
            multiline
          />
          <Button
            label="Reject"
            variant="danger"
            onPress={() =>
              decide.mutate({ kind: 'reject', id: suggestion.id, note: reason.trim() })
            }
            disabled={reason.trim() === ''}
            busy={decide.isPending}
          />
          <Button label="Cancel" variant="secondary" onPress={() => setRejecting(false)} />
        </View>
      ) : (
        <View style={styles.actions}>
          <Button
            label={`Approve ${title}`}
            onPress={() => void approve()}
            busy={decide.isPending}
          />
          <Button
            label={`Reject ${title}`}
            variant="secondary"
            onPress={() => setRejecting(true)}
            disabled={decide.isPending}
          />
        </View>
      )}

      {decide.isError ? (
        <ThemedText type="small" style={{ color: colors.danger }} accessibilityRole="alert">
          {decisionError(decide.error)}
        </ThemedText>
      ) : null}
    </View>
  );
}

/** The server's reason when it gave one ("already reviewed"); otherwise a general message. */
function decisionError(error: unknown): string {
  // Not instanceof: it's unreliable for Error subclasses on the web build (see CLAUDE.md).
  const detail = (error as AdminReviewError | null)?.detail;
  return detail ?? "Couldn't save the decision. Check your connection and try again.";
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
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
  },
  column: {
    width: '100%',
    maxWidth: MaxContentWidth / 1.5,
    gap: Spacing.four,
  },
  card: {
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  candidates: {
    gap: Spacing.two,
  },
  candidate: {
    gap: Spacing.one,
  },
  reject: {
    gap: Spacing.two,
  },
  actions: {
    gap: Spacing.two,
  },
});
