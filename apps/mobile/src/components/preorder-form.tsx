import {
  formatMoney,
  moneyInputValue,
  parseMoney,
  type CreatePreorderRequest,
  type Currency,
  type PreorderResponse,
  type ReleaseDate,
} from '@fandex/core';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from './button';
import { CurrencyChips } from './currency-chips';
import { FormField } from './form-field';
import { ReleaseDateField } from './release-date-field';
import { ThemedText } from './themed-text';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { localToday } from '@/utils/today';

/** Everything the form edits (the catalog item is chosen before). */
export type PreorderFields = Omit<CreatePreorderRequest, 'catalogItemId'>;

type Props = {
  /** The pre-order being edited; empty for a new one. */
  initial?: PreorderResponse;
  /**
   * For a new pre-order of something upcoming: its catalog's release date, filled in — Open
   * Library's for a book (checked daily), Fandex's figure catalog's for a figure.
   */
  suggestedRelease?: ReleaseDate;
  suggestedReleaseFrom?: 'openlibrary' | 'fandex';
  /** A new pre-order's currency: the user's preference (Account tab). */
  defaultCurrency?: Currency;
  submitLabel: string;
  busy: boolean;
  /** Shown above the button when saving failed. */
  error?: string | undefined;
  onSubmit: (fields: PreorderFields) => void;
};

/**
 * A pre-order's price and payments, dates and store. Amounts are typed as text and parsed
 * exactly by core (never floats); empty optional fields are sent as "none".
 */
export function PreorderForm({
  initial,
  suggestedRelease,
  suggestedReleaseFrom = 'openlibrary',
  defaultCurrency,
  submitLabel,
  busy,
  error,
  onSubmit,
}: Props) {
  const colors = useTheme();
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? defaultCurrency ?? 'USD');
  const [price, setPrice] = useState(
    initial?.price !== undefined ? moneyInputValue(initial.price, initial.currency) : '',
  );
  const [paid, setPaid] = useState(
    initial?.paid ? moneyInputValue(initial.paid, initial.currency) : '',
  );
  const [dueDate, setDueDate] = useState<ReleaseDate | null>(
    initial?.balanceDueDate ? { date: initial.balanceDueDate, precision: 'day' } : null,
  );
  const [release, setRelease] = useState<ReleaseDate | null>(
    initial?.expectedRelease ?? suggestedRelease ?? null,
  );
  const fromCatalog =
    suggestedRelease !== undefined &&
    release?.date === suggestedRelease.date &&
    release.precision === suggestedRelease.precision;
  const [store, setStore] = useState(initial?.store ?? '');
  const [orderNumber, setOrderNumber] = useState(initial?.orderNumber ?? '');
  const [orderUrl, setOrderUrl] = useState(initial?.orderUrl ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');

  const priceMinor = price.trim() ? parseMoney(price, currency) : undefined;
  const paidMinor = paid.trim() ? parseMoney(paid, currency) : 0;
  // Explicit conditions: `text && message` would yield '' for an empty field, and an empty
  // problem would silently disable the button.
  const problems: string[] = [];
  if (priceMinor === null) problems.push('The price isn’t an amount.');
  if (paidMinor === null) problems.push('What’s paid isn’t an amount.');
  if (priceMinor != null && paidMinor != null && paidMinor > priceMinor) {
    problems.push('What’s paid can’t be more than the price.');
  }
  if (orderUrl.trim() !== '' && !/^https?:\/\/\S+$/.test(orderUrl.trim())) {
    problems.push('The order link must be a web address (https://…).');
  }
  const balance =
    priceMinor != null && paidMinor != null ? Math.max(0, priceMinor - paidMinor) : undefined;

  const submit = () => {
    if (problems.length > 0 || busy) return;
    onSubmit({
      currency,
      ...(priceMinor != null && { price: priceMinor }),
      paid: paidMinor ?? 0,
      ...(dueDate && { balanceDueDate: dueDate.date }),
      ...(release && { expectedRelease: release }),
      store,
      orderNumber,
      ...(orderUrl.trim() && { orderUrl: orderUrl.trim() }),
      notes,
    });
  };

  return (
    <View style={styles.form}>
      <CurrencyChips label="Currency" value={currency} onChange={setCurrency} />
      <FormField
        label="Price (optional)"
        value={price}
        onChangeText={setPrice}
        placeholder="350.00"
        keyboardType="decimal-pad"
      />
      <FormField
        label="Paid so far"
        value={paid}
        onChangeText={setPaid}
        placeholder="0 (the deposit, if you paid one)"
        keyboardType="decimal-pad"
      />
      {balance !== undefined && balance > 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Balance left: {formatMoney(balance, currency)}
        </ThemedText>
      ) : null}
      <ReleaseDateField
        label="Balance due"
        value={dueDate}
        onChange={setDueDate}
        precisions={['day']}
        startFrom={localToday()}
      />
      <ReleaseDateField
        label="Expected release"
        value={release}
        onChange={setRelease}
        precisions={['day', 'month', 'quarter', 'year']}
        startFrom={localToday()}
      />
      {fromCatalog ? (
        <ThemedText type="small" themeColor="textSecondary">
          {suggestedReleaseFrom === 'fandex'
            ? "From Fandex's figure catalog. Makers often move dates: change it if yours does."
            : 'From Open Library. Fandex checks it daily and moves the date if it changes.'}
        </ThemedText>
      ) : null}
      <FormField
        label="Store (optional)"
        value={store}
        onChangeText={setStore}
        placeholder="Sideshow"
      />
      <FormField
        label="Order number (optional)"
        value={orderNumber}
        onChangeText={setOrderNumber}
        autoCapitalize="characters"
      />
      <FormField
        label="Order link (optional)"
        value={orderUrl}
        onChangeText={setOrderUrl}
        placeholder="https://…"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />
      <FormField label="Notes (optional)" value={notes} onChangeText={setNotes} multiline />

      {[...problems, ...(error ? [error] : [])].map((problem) => (
        <ThemedText
          key={problem}
          type="small"
          style={{ color: colors.danger }}
          accessibilityRole="alert"
        >
          {problem}
        </ThemedText>
      ))}
      <Button label={submitLabel} onPress={submit} busy={busy} disabled={problems.length > 0} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.three,
  },
});
