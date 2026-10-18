import type { Currency } from '@fandex/core';
import { StyleSheet } from 'react-native';

import { Card } from '@/components/card';
import { CurrencyChips } from '@/components/currency-chips';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useSetPreferredCurrency } from '@/hooks/use-account';
import { useTheme } from '@/hooks/use-theme';

/** Account settings that follow you between devices: the currency new pre-orders start in. */
export function PreferencesCard({ currency }: { currency: Currency }) {
  const colors = useTheme();
  const setCurrency = useSetPreferredCurrency();
  // Show the choice at once; the account re-reads when the server has it.
  const shown = setCurrency.isPending ? setCurrency.variables : currency;

  return (
    <Card style={styles.card}>
      <ThemedText type="section">Preferences</ThemedText>
      <CurrencyChips
        label="Currency for new pre-orders"
        value={shown}
        onChange={(next) => {
          if (next !== currency) setCurrency.mutate(next);
        }}
      />
      {setCurrency.error && (
        <ThemedText type="small" accessibilityRole="alert" style={{ color: colors.danger }}>
          Couldn&apos;t save the currency. {setCurrency.error.message}
        </ThemedText>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
  },
});
