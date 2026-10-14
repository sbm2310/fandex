import type { CatalogFigure } from '@fandex/core';
import { StyleSheet, View } from 'react-native';

import { Button } from './button';
import { ThemedText } from './themed-text';

import { Spacing } from '@/constants/theme';
import { useCurrentUser } from '@/hooks/use-account';
import { useSuggestFigure, useSuggestionFor } from '@/hooks/use-figure-suggestions';
import { useTheme } from '@/hooks/use-theme';

/**
 * On a figure's page: suggest a figure you added by hand for Fandex's shared catalog, and see
 * what became of the suggestion (waiting, approved, merged into a catalog figure, or not added
 * with the reviewer's reason). Signed in only: suggestions and reviews live in the account.
 */
export function FigureSuggestionSection({ figure }: { figure: CatalogFigure }) {
  const colors = useTheme();
  const { data: user } = useCurrentUser();
  const { suggestion, isPending } = useSuggestionFor(figure);
  const suggest = useSuggestFigure();
  const catalogItemId = figure.catalogId;

  if (!user || !catalogItemId || isPending) return null;

  if (figure.source === 'fandex') {
    if (suggestion?.status === 'approved') {
      return (
        <Status text="You suggested this figure, and it's in Fandex's catalog now: everyone can find it." />
      );
    }
    if (suggestion?.status === 'merged') {
      return (
        <Status text="You suggested this figure, and Fandex's catalog already had it: your copy now points to the catalog's." />
      );
    }
    return null;
  }

  if (suggestion?.status === 'pending') {
    return <Status text="Suggested for Fandex's catalog: waiting for review." />;
  }

  const offer = () => suggest.mutate({ catalogItemId });
  return (
    <View style={styles.section}>
      {suggestion?.status === 'rejected' ? (
        <ThemedText type="small" themeColor="textSecondary">
          Not added to Fandex&apos;s catalog
          {suggestion.reviewNote ? `: ${suggestion.reviewNote}` : '.'}
        </ThemedText>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          Only you can see this figure. Suggest it for Fandex&apos;s catalog and, once it&apos;s
          checked, every collector can find it (without its picture).
        </ThemedText>
      )}
      <Button
        label={
          suggestion?.status === 'rejected' ? 'Suggest it again' : "Suggest it for Fandex's catalog"
        }
        variant="secondary"
        onPress={offer}
        busy={suggest.isPending}
      />
      {suggest.isError ? (
        <ThemedText type="small" style={{ color: colors.danger }} accessibilityRole="alert">
          Couldn&apos;t send the suggestion. Try again.
        </ThemedText>
      ) : null}
    </View>
  );
}

function Status({ text }: { text: string }) {
  return (
    <ThemedText type="small" themeColor="textSecondary">
      {text}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
});
